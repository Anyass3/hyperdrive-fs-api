import test from 'brittle'
import Corestore from 'corestore';
import RAM from 'random-access-memory'
import Hyperdrive from './lib/index.js';

const getDrive = () => {

    const corestore = new Corestore((() => {
        return new RAM();
    }))

    return new Hyperdrive(corestore);
}

async function main() {

    const corestore = new Corestore((() => {
        return new RAM();
    }))

    const drive = new Hyperdrive(corestore);
    await drive.put('/a/b', Buffer.from('bvbv'))
    await drive.put('/a/c', Buffer.from(''))
    await drive.put('/a/d/p', Buffer.from(''))
    await drive.put('/a/e/d', Buffer.from(''))
    await drive.put('/a/b/r', Buffer.from(''))
    await drive.put('/a/c/p/', Buffer.from(''))
    await drive.put('/a/b/d/', Buffer.from(''))
    console.log('list', await drive.list('/a', { recursive: false }))
    // console.log('dir', await drive.list('/a/b'));
    console.log('dir', await drive.list('/a', { stat: true }));
    // console.log(await drive.entry('/a/b'));
    // console.log(await drive.get('/a/b/'));
}
// main()

console.log('testing...');

test('create files', async t => {
    const drive = getDrive();
    await drive.write('/dir1/dir2/file.txt', 'hi there', 'utf-8');
    await drive.write('/dir1/file.txt', 'hi', 'utf-8');

    const list1 = await drive.list('/', { recursive: true });
    const list2 = await drive.list('/dir1', { recursive: false });

    // console.log(list2)
    t.is(list1.length, 4)
    t.is(list2.length, 2) // needs resolving;

    t.ok(await drive.exists('/dir1/dir2/file.txt'))
    t.absent(list1[0].stat)

    t.comment('comparing buffer to buffer')
    t.alike(Buffer.from('hi there'), await drive.get('/dir1/dir2/file.txt'))
})