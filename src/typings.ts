import type { Readable } from "streamx";

export type HyperBlob = { byteOffset: number; blockOffset: number; blockLength: number; byteLength: number }
export type Node = { seq: number | null; key: string; value: HyperBlob | null }

interface BaseStat {
    atime: string,
    mtime: string,
    ctime: string,
    birthtime: string,
    atimeMs: number,
    mtimeMs: number,
    ctimeMs: number,
    birthtimeMs: number,
    isDirectory: () => boolean,
    isFile: () => boolean,
}
export interface StatDir extends BaseStat {
    // itemsCount: number;
}

export interface StatFile extends BaseStat {
    byteOffset: number,
    blockOffset: number,
    blockLength: number,
    byteLength: number,
    key: string,
    seq: number,
    executable: false,
    linkname: string,
    size: number
}

export type Stat = StatDir & StatFile

export interface Item<S> { name: string; path: string, stat: S extends true ? Stat : null }

export type ListOpts<S extends boolean = boolean, B extends boolean = boolean> = Partial<{
    recursive: boolean; withStats: S; fileOnly: boolean; readable: B; search: string | RegExp;
}>
export type List<S extends boolean = boolean, B extends boolean = boolean> = B extends true ? Readable<Item<S>> : Promise<Item<S>[]>;

export type ReadDir<S extends boolean = boolean, B extends boolean = boolean> = List<S, B>;
export type ReadDirOpts<S extends boolean = boolean, B extends boolean = boolean> = Omit<ListOpts<S, B>, 'recursive'> & { nameOnly?: boolean };