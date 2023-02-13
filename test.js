import test from 'brittle'
import Corestore from 'corestore';
import RAM from 'random-access-memory'
import { pipelinePromise } from 'streamx';
import Hyperdrive from './lib/index.js';

const getDrive = () => {

    const corestore = new Corestore((() => {
        return new RAM();
    }))

    return new Hyperdrive(corestore);
}

console.log('testing...');

test('create files/dirs', async t => {
    const drive = getDrive();
    await drive.write('/dir1/dir2/file.txt', 'hi there', 'utf-8');
    await drive.write('/dir1/file.txt', 'hi', 'utf-8');

    const list1 = await drive.list('/', { recursive: true });
    const list2 = await drive.readdir('/dir1');

    t.is(list1.length, 4)
    t.is(list2.length, 2)
    t.exception(() => drive.put('/dir1/dir2', Buffer.from('')))
    t.exception(() => drive.put('/dir1/file.txt/any', Buffer.from('')))

    t.ok(await drive.exists('/dir1/dir2/file.txt'))
    t.comment('comparing buffer to buffer')
    t.alike(Buffer.from('hi there'), await drive.get('/dir1/dir2/file.txt'))
})

test('files/dirs stats', async t => {
    const drive = getDrive();
    await drive.write('/dir1/dir2/file.txt', 'hi there', 'utf-8');
    await drive.write('/dir1/file.txt', 'hi', 'utf-8');

    const list1 = await drive.list('/', { recursive: true });
    const list2 = await drive.readdir('/dir1', { withStats: true });

    t.absent(list1[0].stat)
    t.ok(list2[0].stat)
    t.ok((await drive.stat('/dir1/dir2/file.txt')).birthtimeMs < (await drive.stat('/dir1/file.txt')).birthtimeMs)
    t.ok((await drive.stat('/dir1/dir2/')).mtimeMs < (await drive.stat('/dir1/')).mtimeMs)
})

test('Coping and moving files', async t => {
    const drive = getDrive();
    await drive.write('/dir1/dir2/file.txt', 'hi there', 'utf-8');
    await drive.copy('/dir1/dir2/file.txt', '/copyed.txt');

    t.is(await drive.get('/dir1/dir2/file.txt').toString(), await drive.get('/copyed.txt').toString())

    await drive.move('/dir1/dir2/file.txt', '/moved.txt');

    t.not(await drive.exists('/dir1/dir2/file.txt'))

    t.ok(await drive.exists('/moved.txt'))
})

test('stream folders/dirs', async t => {
    const drive = getDrive();
    await drive.write('/dir1/abc.txt', 'abcdefg', 'utf-8');
    await drive.write('/dir1/dir2/hi.txt', 'hi me', 'utf-8');
    await drive.write('/dir1/doc/greeting.txt', 'hello there! How are you', 'utf-8');

    await pipelinePromise(drive.createFolderReadStream('/dir1/'), drive.createFolderWriteStream('/streamed/'))

    const list1 = await drive.list('/dir1', { recursive: true, });
    const list2 = await drive.list('/streamed', { recursive: true });
    const mapper = ({ name, path }) => ({ name, path: path.replace(/^\/((dir1)|(streamed))/, '') });

    t.alike(list1.map(mapper), list2.map(mapper));
})
