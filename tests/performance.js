
import Corestore from 'corestore';
import RAM from 'random-access-memory'
import Hyperdrive from '../lib/index.js';

async function timeIt(fn, runs = 10) {
    let totalTime = 0
    for (let i = 0; i < runs; i++) {
        const t1 = performance.now()
        await fn()
        const t2 = performance.now()
        totalTime += t2 - t1;
    }
    return totalTime / runs
}

async function speedTest(runs = 50) {

    const corestore = new Corestore((() => {
        return new RAM();
    }))

    const drive = new Hyperdrive(corestore);

    console.time('import')
    await drive.import('../lib', 'lib');
    await drive.import('../src', 'lib');
    // await drive.import('../@types', 'lib');
    console.timeEnd('import')

    let folder = '/assa/as/sa/sa';

    console.time('folder:slice')
    if (folder.endsWith('/')) folder.slice(0, -1);
    console.timeEnd('folder:slice')

    console.time('folder:replace')
    folder.replace(/\/$/, '');
    console.timeEnd('folder:replace')

    const super_list = await timeIt(async () => {
        // let count = 0;
        for await (const _ of drive._list('/lib', { recursive: true })) {
            // count++
        }
        // console.log('slist', count)
    }, runs)

    const list_readable = await timeIt(async () => {
        // let count = 0;
        for await (const _ of drive.list('/lib', { search: '', fileOnly: true, readable: true })) {
            // count++
        }
        // console.log('list', count)
    }, runs)
    const list_array = await timeIt(async () => {
                /*console.log('list:array', (*/await drive.list('/lib', { search: '', fileOnly: true })//).length)
    }, runs)
    const super_readdir = await timeIt(async () => {
        // let count = 0;
        for await (const _ of drive._readdir('/lib')) {
            // count++
        }
        // console.log('sreaddir', count)
    }, runs)
    const readdir_readable = await timeIt(async () => {
        // let count = 0;
        for await (const _ of drive.readdir('/lib', { readable: true, withStats: true, })) {
            // count++
        }
        // console.log('readdir', count)
    }, runs)
    const readdir_array = await timeIt(async () => {
               /* console.log('readdir:array', */(await drive.readdir('/lib', { nameOnly: true }))//.length)
    }, runs)

    const result = { super_readdir, readdir_readable, readdir_array, readdir_readable_improvement: super_readdir - readdir_readable, super_list, list_readable, list_array, list_readable_improvement: super_list - list_readable };
    for (const key in result) {
        console.log(`${key}: ${result[key] / runs}  @${runs}`)
    }
}

speedTest(1000)