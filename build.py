import os
import subprocess
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
ESBUILD = os.path.join(ROOT, '.bin', 'esbuild.exe')

def run_build():
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    if os.path.exists(ESBUILD):
        print("Using .bin/esbuild.exe...")
        subprocess.run([
            ESBUILD,
            os.path.join(ROOT, 'js', 'bundle-entry.js'),
            '--bundle',
            '--minify',
            '--format=iife',
            '--target=es2020',
            f'--outfile={os.path.join(ROOT, "dist", "app.min.js")}'
        ], check=True)
        subprocess.run([
            ESBUILD,
            os.path.join(ROOT, 'css', 'style.css'),
            '--minify',
            f'--outfile={os.path.join(ROOT, "dist", "style.min.css")}'
        ], check=True)
        shutil.copyfile(os.path.join(ROOT, 'dist', 'app.min.js'), os.path.join(ROOT, 'js', 'app.min.js'))
        shutil.copyfile(os.path.join(ROOT, 'dist', 'style.min.css'), os.path.join(ROOT, 'css', 'style.min.css'))
        print("Build complete!")
    else:
        print("esbuild not found. Run via node build.js on Vercel or install esbuild.")

if __name__ == '__main__':
    run_build()
