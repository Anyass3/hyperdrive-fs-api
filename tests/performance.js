
import Corestore from 'corestore';
import RAM from 'random-access-memory'
import Hyperdrive from '../lib/index.js';

async function timeTaken(fn) {
    const t1 = performance.now()
    await fn()
    const t2 = performance.now()
    return t2 - t1;
}

async function speedTest(times = 50) {

    const corestore = new Corestore((() => {
        return new RAM();
    }))

    const drive = new Hyperdrive(corestore);

    console.time('import')
    await drive.import('lib', 'lib');
    await drive.import('src', 'lib');
    await drive.import('@types', 'lib');
    console.timeEnd('import')
    let folder = '/assa/as/sa/sa';

    console.time('folder:slice')
    if (folder.endsWith('/')) folder.slice(0, -1);
    console.timeEnd('folder:slice')

    console.time('folder:replace')
    folder.replace(/\/$/, '');
    console.timeEnd('folder:replace')

    let list_readable = 0, super_list = 0, list_array = 0, readdir_readable = 0, super_readdir = 0, readdir_array = 0;
    for (let i = 0; i < times; i++) {
        {
            super_list += await timeTaken(async () => {
                // let count = 0;
                for await (const _ of drive._list('/lib', { recursive: true })) {
                    // count++
                }
                // console.log('slist', count)
            })
        }

        {
            list_readable += await timeTaken(async () => {
                // let count = 0;
                for await (const _ of drive.list('/lib', { search: '', fileOnly: true, readable: true })) {
                    // count++
                }
                // console.log('list', count)
            })
        }

        {
            list_array += await timeTaken(async () => {
                /*console.log('list:array', (*/await drive.list('/lib', { search: '', fileOnly: true })//).length)
            })
        }

        {
            super_readdir += await timeTaken(async () => {
                // let count = 0;
                for await (const _ of drive._readdir('/lib')) {
                    // count++
                }
                // console.log('sreaddir', count)
            })
        }

        {
            readdir_readable += await timeTaken(async () => {
                // let count = 0;
                for await (const _ of drive.readdir('/lib', { readable: true, nameOnly: true })) {
                    // count++
                }
                // console.log('readdir', count)
            })
        }

        {
            readdir_array += await timeTaken(async () => {
               /* console.log('readdir:array', */(await drive.readdir('/lib', { nameOnly: true }))//.length)
            })
        }
    }
    const result = { super_readdir, readdir_readable, readdir_array, readdir_readable_improvement: super_readdir - readdir_readable, super_list, list_readable, list_array, list_readable_improvement: super_list - list_readable };
    for (const key in result) {
        console.log(`${key}: ${result[key] / times}  @${times}`)
    }
}


speedTest(100)