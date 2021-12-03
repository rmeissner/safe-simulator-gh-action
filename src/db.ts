import MD, { MemDown } from "memdown"
import { ErrorCallback, AbstractOpenOptions, ErrorValueCallback, AbstractGetOptions, AbstractOptions, AbstractChainedBatch, AbstractBatch, AbstractIteratorOptions, AbstractIterator } from "abstract-leveldown"

export class LoggingDb extends MD {

    logging: boolean = false
    readonly touched = new Set<string>()

    get(key: any, cb: ErrorValueCallback<any>): void
    get(key: any, options: AbstractGetOptions, cb: ErrorValueCallback<any>): void
    get(key: any, options: any, cb?: any): void {
        if (options && typeof cb === "function")
            super.get(key, options, cb)
        else if (typeof options !== "function")
            super.get(key, options, cb)
        else
            super.get(key, options)
    }

    put(key: any, value: any, cb: ErrorValueCallback<any>): void
    put(key: any, value: any, options: AbstractGetOptions, cb: ErrorValueCallback<any>): void
    put(key: any, value: any, options: any, cb?: any): void {
        if (this.logging && typeof key === "string" && key.indexOf("trie_db") >= 0) {
            if (key.indexOf("touched!0x") >= 0) {
                this.touched.add(key)
            }
        }
        if (options && typeof cb === "function")
            super.put(key, value, options, cb)
        else if (typeof options !== "function")
            super.put(key, value, options, cb)
        else
            super.put(key, value, options)
    }

    batch(): AbstractChainedBatch<any, any>
    batch(array: ReadonlyArray<AbstractBatch<any, any>>, cb: ErrorCallback): AbstractChainedBatch<any, any>
    batch(
        array: ReadonlyArray<AbstractBatch<any, any>>,
        options: AbstractOptions,
        cb: ErrorCallback,
    ): AbstractChainedBatch<any, any>
    batch(array?: any, options?: any, cb?: any): AbstractChainedBatch<any, any> {
        if (this.logging && Array.isArray(array))
            array.forEach((value) => {
                if (typeof value.key === "string" && value.key.indexOf("trie_db") >= 0) {
                    if (value.key.indexOf("touched!0x") >= 0) {
                        this.touched.add(value.key)
                    }
                }
            })
        if (options && typeof cb === "function")
            return super.batch(array, options, cb)
        else if (typeof options !== "function")
            return super.batch(array, options, cb)
        else
            return super.batch()
    }
}