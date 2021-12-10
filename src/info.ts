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
        let modules = []
        try {
            const modulePage = await safe.getModulesPaginated(ethers.constants.AddressZero, 10)
            modules = modulePage[0]
        } catch (error) {
            console.error(error)
            try {
                modules = await safe.getModules()
            } catch (error) {
                console.error(error)
            }
        }
        return {
            address: ethers.utils.getAddress(safeAddress),
            owners: await safe.getOwners(),
            modules,
            nonce: (await safe.nonce()).toNumber()
        }
    }
}