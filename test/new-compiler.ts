import * as fs from 'fs';
import * as path from 'path';
import compile from '../src/index';

describe('New compiler', () => {
    function read(fileName: string): string {
        return fs.readFileSync(path.resolve(__dirname, fileName), 'utf8').trim();
    }

    it.only('debug', () => {
        const files = [
            'templates/basic1.html', 'templates/basic2.html', 'templates/branching.html',
            'templates/iterate.html', 'templates/key-iterate.html', 'templates/inner-html.html',
            'templates/attribute1.html', 'templates/attribute2.html', 'templates/props.html',
            'templates/variables.html', 'templates/partials.html', 'templates/partials-override.html',
            'templates/events.html', 'templates/events-loop.html'
        ];

        files.forEach(file => {
            const { code } = compile(read(`./samples/${file}`), file);
            fs.writeFileSync(path.resolve(__dirname, `./fixtures2/${file.replace(/\.html$/, '.js')}`), code.trim());
        });
    });
});
