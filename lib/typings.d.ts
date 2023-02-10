import type { Readable } from "streamx";
export type HyperBlob = {
    byteOffset: number;
    blockOffset: number;
    blockLength: number;
    byteLength: number;
};
export type Node = {
    seq: number | null;
    key: string;
    value: HyperBlob | null;
};
interface BaseStat {
    atime: string;
    mtime: string;
    ctime: string;
    birthtime: string;
    atimeMs: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
    isDirectory: () => boolean;
    isFile: () => boolean;
}
export interface StatDir extends BaseStat {
    itemsCount: number;
}
export interface StatFile extends BaseStat {
    byteOffset: number;
    blockOffset: number;
    blockLength: number;
    byteLength: number;
    key: string;
    seq: number;
    executable: false;
    linkname: string;
    size: number;
}
export type Stat = StatDir & StatFile;
export interface Item<S> {
    name: string;
    path: string;
    stat: S extends false ? null : Stat;
}
export type ListOpts<S, B> = Partial<{
    recursive: boolean;
    stat: S;
    fileOnly: boolean;
    readable: B;
}>;
export type List<S, B> = B extends false ? Promise<Item<S>[]> : Readable<Item<S>>;
export type ReadDir<S, B> = List<S, B>;
export type ReadDirOpts<S, B> = ListOpts<S, B> & {
    nameOnly?: boolean;
};
export {};
