import http.server
import socketserver
import webbrowser
import os
import sys
import json
import urllib.request
import urllib.parse
import hmac
import hashlib
import base64
import time

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

SECRET = os.environ.get('API_SECRET', 'a8f5e3d2c1b0987654321fedcba0123456789abcdef0123456789abcdef01234').encode('utf-8')
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://vwglpnluozdgnztasrrp.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', os.environ.get('SUPABASE_ANON_KEY', 'sb_publishable_ffnMzR_piobvuDkt1VPzyw_dNQDLzdE'))

def fetch_supabase(endpoint, method='GET', body=None, prefer=None):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f"Bearer {SUPABASE_KEY}",
        'Content-Type': 'application/json'
    }
    if prefer:
        headers['Prefer'] = prefer
    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode('utf-8')
            return json.loads(content) if content else None
    except Exception:
        return None

def safe_equal(a, b):
    if not isinstance(a, str) or not isinstance(b, str):
        return False
    a_bytes = a.encode('utf-8')
    b_bytes = b.encode('utf-8')
    if len(a_bytes) != len(b_bytes):
        return False
    return hmac.compare_digest(a_bytes, b_bytes)

def create_answer_hash(post_id, author_id):
    return hmac.new(SECRET, f"{post_id}:{author_id}".encode('utf-8'), hashlib.sha256).hexdigest()

def create_question_token(post_id, correct_author_id):
    data = {
        'id': post_id,
        'ansHash': create_answer_hash(post_id, correct_author_id),
        'exp': int(time.time()) + 900
    }
    payload = base64.urlsafe_b64encode(json.dumps(data).encode('utf-8')).decode('utf-8').rstrip('=')
    sig = hmac.new(SECRET, payload.encode('utf-8'), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"

def verify_question_token(token):
    if not token or '.' not in token:
        return None
    payload_str, sig = token.split('.', 1)
    expected_sig = hmac.new(SECRET, payload_str.encode('utf-8'), hashlib.sha256).hexdigest()
    if not safe_equal(sig, expected_sig):
        return None
    try:
        pad = len(payload_str) % 4
        padded = payload_str + ('=' * (4 - pad) if pad else '')
        data = json.loads(base64.urlsafe_b64decode(padded.encode('utf-8')).decode('utf-8'))
        if time.time() > data.get('exp', 0):
            return None
        return data
    except Exception:
        return None

def password_fingerprint(stored_password):
    return hmac.new(SECRET, f"pwf:{stored_password}".encode('utf-8'), hashlib.sha256).hexdigest()[:32]

def create_admin_token(stored_password):
    data = {
        'role': 'admin',
        'iat': int(time.time()),
        'pwf': password_fingerprint(stored_password),
        'exp': int(time.time()) + 86400
    }
    payload = base64.urlsafe_b64encode(json.dumps(data).encode('utf-8')).decode('utf-8').rstrip('=')
    sig = hmac.new(SECRET, payload.encode('utf-8'), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"

def verify_admin_token(token):
    if not token or not isinstance(token, str):
        return False
    clean = token.replace('Bearer ', '').replace('bearer ', '').strip()
    if '.' not in clean:
        return False
    payload_str, sig = clean.split('.', 1)
    expected_sig = hmac.new(SECRET, payload_str.encode('utf-8'), hashlib.sha256).hexdigest()
    if not safe_equal(sig, expected_sig):
        return False
    try:
        pad = len(payload_str) % 4
        padded = payload_str + ('=' * (4 - pad) if pad else '')
        data = json.loads(base64.urlsafe_b64decode(padded.encode('utf-8')).decode('utf-8'))
        if time.time() > data.get('exp', 0) or data.get('role') != 'admin' or not data.get('pwf'):
            return False
    except Exception:
        return False
    stored = get_stored_admin_password()
    if not stored:
        return False
    return safe_equal(data.get('pwf'), password_fingerprint(stored))

def get_stored_admin_password():
    data = fetch_supabase('admin_settings?key=eq.admin_password&select=value')
    if data and isinstance(data, list) and len(data) > 0 and data[0].get('value'):
        return str(data[0]['value']).strip()
    return os.environ.get('ADMIN_PASSWORD')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith('/api/quiz'):
            self.handle_api_quiz_get(parsed)
            return
        elif parsed.path.startswith('/api/admin'):
            self.handle_api_admin_get(parsed)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        content_len = int(self.headers.get('Content-Length', 0))
        body = {}
        if content_len > 0:
            raw = self.rfile.read(content_len).decode('utf-8')
            try:
                body = json.loads(raw)
            except Exception:
                body = {}

        if parsed.path.startswith('/api/quiz'):
            self.handle_api_quiz_post(parsed, body)
            return
        elif parsed.path.startswith('/api/admin'):
            self.handle_api_admin_post(parsed, body)
            return

        self.send_json(404, {'error': 'Not Found'})

    def handle_api_quiz_get(self, parsed):
        qs = urllib.parse.parse_qs(parsed.query)
        action = qs.get('action', ['get_questions'])[0]
        mode = qs.get('mode', ['blitz'])[0]

        id_rows = fetch_supabase('posts?select=id') or []
        authors = fetch_supabase('authors?select=*') or []

        all_ids = [r.get('id') for r in id_rows if isinstance(r, dict) and r.get('id') is not None]
        if not all_ids:
            self.send_json(200, {'questions': [], 'total': 0})
            return

        import random
        shuffled_ids = list(all_ids)
        random.shuffle(shuffled_ids)
        picked_ids = shuffled_ids[:10] if mode == 'blitz' else shuffled_ids[:25]

        in_list = ','.join(str(i) for i in picked_ids)
        posts = fetch_supabase(f"posts?id=in.({in_list})&select=*") or []
        posts_by_id = {p.get('id'): p for p in posts if isinstance(p, dict)}
        selected_posts = [posts_by_id[i] for i in picked_ids if i in posts_by_id]

        if not selected_posts:
            self.send_json(200, {'questions': [], 'total': 0})
            return

        questions = []
        for p in selected_posts:
            correct_id = p.get('correct_author_id')
            correct_auth = next((a for a in authors if a.get('id') == correct_id), None)
            if not correct_auth:
                correct_auth = {
                    'id': correct_id,
                    'name': correct_id,
                    'handle': f"@{correct_id}",
                    'avatar_color': 'linear-gradient(135deg, #0288d1, #26c6da)',
                    'avatar_text': '?'
                }

            others = [a for a in authors if a.get('id') != correct_id]
            random.shuffle(others)
            distractors = others[:3]
            while len(distractors) < 3:
                distractors.append({
                    'id': f"unknown_{len(distractors)}",
                    'name': f"Автор {len(distractors) + 1}",
                    'handle': f"@author_{len(distractors) + 1}",
                    'avatar_color': 'linear-gradient(135deg, #7c3aed, #ec4899)',
                    'avatar_text': '?'
                })

            combined = [correct_auth] + distractors
            random.shuffle(combined)

            options = [{
                'id': a.get('id'),
                'name': a.get('name'),
                'handle': a.get('handle'),
                'avatarColor': a.get('avatar_color') or a.get('avatarColor'),
                'avatarText': a.get('avatar_text') or a.get('avatarText') or (a.get('name', '?')[0] if a.get('name') else '?'),
                'verified': bool(a.get('verified'))
            } for a in combined]

            q_token = create_question_token(p.get('id'), correct_id)

            questions.append({
                'id': p.get('id'),
                'postText': p.get('post_text', ''),
                'screenshot': p.get('screenshot', ''),
                'hint': p.get('hint', ''),
                'difficulty': p.get('difficulty', 'normal'),
                'tags': p.get('tags', []),
                'options': options,
                'qToken': q_token
            })

        self.send_json(200, {'questions': questions, 'total': len(questions)})

    def handle_api_quiz_post(self, parsed, body):
        action = body.get('action') or urllib.parse.parse_qs(parsed.query).get('action', ['check_answer'])[0]
        if action == 'check_answer':
            q_token = body.get('qToken')
            selected_id = body.get('selectedAuthorId')

            if not q_token or not selected_id:
                self.send_json(400, {'error': 'qToken and selectedAuthorId are required'})
                return

            token_data = verify_question_token(q_token)
            if not token_data:
                self.send_json(400, {'error': 'Invalid or expired question token'})
                return

            selected_clean = str(selected_id).strip()
            is_correct = safe_equal(create_answer_hash(token_data.get('id'), selected_clean), token_data.get('ansHash'))

            correct_id = selected_clean if is_correct else None
            if not is_correct:
                rows = fetch_supabase(f"posts?id=eq.{urllib.parse.quote(str(token_data.get('id')))}&select=correct_author_id") or []
                if rows and isinstance(rows, list):
                    correct_id = rows[0].get('correct_author_id')

            author_info = None
            if correct_id:
                authors = fetch_supabase(f"authors?id=eq.{urllib.parse.quote(str(correct_id))}&select=*") or []
                if authors and isinstance(authors, list):
                    a = authors[0]
                    author_info = {
                        'id': a.get('id'),
                        'name': a.get('name'),
                        'handle': a.get('handle'),
                        'avatarColor': a.get('avatar_color'),
                        'avatarText': a.get('avatar_text'),
                        'badge': a.get('badge'),
                        'bio': a.get('bio'),
                        'verified': a.get('verified')
                    }

                if not author_info:
                    author_info = {
                        'id': correct_id,
                        'name': correct_id,
                        'handle': f"@{correct_id}",
                        'bio': 'Популярный автор в ИТД'
                    }

            self.send_json(200, {
                'isCorrect': is_correct,
                'correctAuthorId': correct_id,
                'correctAuthor': author_info
            })
            return

        self.send_json(400, {'error': f"Unknown quiz action: {action}"})

    def handle_api_admin_get(self, parsed):
        self.send_json(200, {'ok': True, 'message': 'Admin API active'})

    def handle_api_admin_post(self, parsed, body):
        qs = urllib.parse.parse_qs(parsed.query)
        action = body.get('action') or qs.get('action', [None])[0]
        auth_header = self.headers.get('Authorization', '')

        if action == 'login':
            password = str(body.get('password', '')).strip()
            stored = get_stored_admin_password()
            if not stored:
                self.send_json(500, {'error': 'Password not configured'})
                return

            cand_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()

            if password != stored and cand_hash != stored:
                time.sleep(0.5)
                self.send_json(401, {'error': 'Неверный пароль'})
                return

            token = create_admin_token(stored)
            self.send_json(200, {'ok': True, 'token': token, 'message': 'Авторизация успешна'})
            return

        if action == 'verify':
            token = body.get('token') or auth_header
            valid = verify_admin_token(token)
            self.send_json(200, {'valid': valid})
            return

        token = body.get('adminToken') or auth_header
        if not verify_admin_token(token):
            self.send_json(401, {'error': 'Требуется авторизация администратора'})
            return

        if action == 'save_post':
            post = body.get('post') or {}
            record = {
                'id': post.get('id') or f"post_{int(time.time()*1000)}",
                'correct_author_id': post.get('correctAuthorId'),
                'post_text': post.get('postText', ''),
                'screenshot': post.get('screenshot'),
                'hint': post.get('hint', ''),
                'difficulty': post.get('difficulty', 'normal'),
                'tags': post.get('tags', []),
                'likes': post.get('likes', 0)
            }
            fetch_supabase('posts', method='POST', prefer='resolution=merge-duplicates', body=record)
            self.send_json(200, {'ok': True, 'post': record})
            return

        elif action == 'delete_post':
            pid = body.get('id')
            fetch_supabase(f"posts?id=eq.{urllib.parse.quote(str(pid))}", method='DELETE')
            self.send_json(200, {'ok': True})
            return

        elif action == 'save_author':
            author = body.get('author') or {}
            record = {
                'id': author.get('id'),
                'name': author.get('name'),
                'handle': author.get('handle'),
                'avatar_color': author.get('avatarColor') or author.get('avatar_color'),
                'avatar_text': author.get('avatarText') or author.get('avatar_text'),
                'badge': author.get('badge'),
                'bio': author.get('bio'),
                'verified': bool(author.get('verified'))
            }
            fetch_supabase('authors', method='POST', prefer='resolution=merge-duplicates', body=record)
            self.send_json(200, {'ok': True, 'author': record})
            return

        elif action == 'delete_author':
            aid = body.get('id')
            fetch_supabase(f"authors?id=eq.{urllib.parse.quote(str(aid))}", method='DELETE')
            self.send_json(200, {'ok': True})
            return

        elif action == 'change_password':
            new_pass = str(body.get('newPassword', '')).strip()
            if len(new_pass) < 3:
                self.send_json(400, {'error': 'Пароль слишком короткий'})
                return
            fetch_supabase('admin_settings', method='POST', prefer='resolution=merge-duplicates', body={
                'key': 'admin_password',
                'value': new_pass,
                'updated_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            })
            self.send_json(200, {'ok': True, 'token': create_admin_token(new_pass), 'message': 'Пароль администратора обновлен'})
            return

        elif action == 'moderate_post':
            sid = body.get('id')
            status = body.get('status')
            post_record = body.get('postRecord')
            if status == 'approved' and post_record:
                fetch_supabase('posts', method='POST', prefer='resolution=merge-duplicates', body={
                    'id': post_record.get('id') or f"post_{int(time.time()*1000)}",
                    'correct_author_id': post_record.get('correctAuthorId'),
                    'post_text': post_record.get('postText', ''),
                    'screenshot': post_record.get('screenshot'),
                    'hint': post_record.get('hint', ''),
                    'difficulty': 'normal',
                    'tags': ['#итд']
                })
            fetch_supabase(f"suggestions_posts?id=eq.{urllib.parse.quote(str(sid))}", method='PATCH', body={'status': status})
            self.send_json(200, {'ok': True})
            return

        elif action == 'moderate_author':
            aid = body.get('id')
            status = body.get('status')
            author_record = body.get('authorRecord')
            if status == 'approved' and author_record:
                fetch_supabase('authors', method='POST', prefer='resolution=merge-duplicates', body={
                    'id': author_record.get('id'),
                    'name': author_record.get('name'),
                    'handle': author_record.get('handle'),
                    'avatar_color': author_record.get('avatarColor'),
                    'avatar_text': author_record.get('avatarText'),
                    'badge': author_record.get('badge', 'Автор ИТД'),
                    'bio': author_record.get('bio'),
                    'verified': bool(author_record.get('verified'))
                })
            fetch_supabase(f"suggestions_authors?id=eq.{urllib.parse.quote(str(aid))}", method='PATCH', body={'status': status})
            self.send_json(200, {'ok': True})
            return

        self.send_json(400, {'error': f"Unknown admin action: {action}"})

def run():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"==================================================")
        print(f"  ИТД: Угадай Автора")
        print(f"  Сервер: {url}")
        print(f"==================================================")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            sys.exit(0)

if __name__ == '__main__':
    run()
