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
    await drive.put('/a/d/', Buffer.from(''))
    await drive.put('/a/e/d', Buffer.from(''))
    await drive.put('/a/b/r', Buffer.from(''))
    await drive.put('/a/b/p/', Buffer.from(''))
    await drive.put('/a/b/d/', Buffer.from(''))

    console.log('list', await drive.list('/', { recursive: true }))
    console.log('dir', await drive.list('/a/b'));
    console.log('dir', await drive.list('/a/b', { stat: true }));
    // console.log(await drive.entry('/a/b'));
    console.log(await drive.get('/a/b/'));
}

console.log('testing...');

test('create folders/directories', async t => {
    const drive = getDrive();
    await drive.mkdir('/dir1/dir2/dir3');
    const list1 = await drive.list('/', { recursive: true });
    const list2 = await drive.list('/', { recursive: false });
    const list3 = await drive.list('/', { recursive: false, stat: true });
    t.is(list1.length, 3)
    t.is(list2.length, 1)
    t.ok(await drive.exists('/dir1/dir2'))
    t.absent(await drive.exists('/dir1/dir'))
    t.absent(list1[0].stat)
    t.ok(list3[0].stat)
})
