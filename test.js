console.log('testing...')
import Corestore from 'corestore';
import RAM from 'random-access-memory'
import Hyperdrive from './lib/index.js';

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


main()