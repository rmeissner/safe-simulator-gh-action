import { ethers } from "ethers";
import { safeInterface } from "./contracts";
import { SafeInfo } from "./types";

export class SafeInfoProvider {
    readonly provider: ethers.providers.Provider

    constructor(nodeUrl: string) {
        this.provider = new ethers.providers.JsonRpcProvider(nodeUrl)
    }

    async loadInfo(safeAddress: string): Promise<SafeInfo> {
        const safe = new ethers.Contract(safeAddress, safeInterface, this.provider)
        return {
            address: ethers.utils.getAddress(safeAddress),
            owners: await safe.getOwners(),
            nonce: (await safe.nonce()).toNumber()
        }
    }
}