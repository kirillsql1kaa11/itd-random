const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

async function build() {
    const distDir = path.join(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    const jsCtx = await esbuild.context({
        entryPoints: [path.join(__dirname, 'js', 'bundle-entry.js')],
        bundle: true,
        minify: true,
        target: ['es2020'],
        format: 'iife',
        outfile: path.join(distDir, 'app.min.js'),
        legalComments: 'none',
        treeShaking: true
    });

    const cssCtx = await esbuild.context({
        entryPoints: [path.join(__dirname, 'css', 'style.css')],
        minify: true,
        outfile: path.join(distDir, 'style.min.css'),
        legalComments: 'none'
    });

    if (isWatch) {
        await Promise.all([jsCtx.watch(), cssCtx.watch()]);
        console.log('[esbuild] Watching for changes...');
    } else {
        await Promise.all([jsCtx.rebuild(), cssCtx.rebuild()]);
        await Promise.all([jsCtx.dispose(), cssCtx.dispose()]);

        // Also duplicate to js/app.min.js and css/style.min.css for compatibility
        fs.copyFileSync(path.join(distDir, 'app.min.js'), path.join(__dirname, 'js', 'app.min.js'));
        fs.copyFileSync(path.join(distDir, 'style.min.css'), path.join(__dirname, 'css', 'style.min.css'));

        const jsSize = (fs.statSync(path.join(distDir, 'app.min.js')).size / 1024).toFixed(1);
        const cssSize = (fs.statSync(path.join(distDir, 'style.min.css')).size / 1024).toFixed(1);

        console.log(`[esbuild] Build successful:`);
        console.log(`  dist/app.min.js:   ${jsSize} KB`);
        console.log(`  dist/style.min.css: ${cssSize} KB`);
    }
}

build().catch((err) => {
    console.error('[esbuild] Build failed:', err);
    process.exit(1);
});
