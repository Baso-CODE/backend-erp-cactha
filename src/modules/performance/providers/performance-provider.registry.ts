import { PerformancePlatform } from "@prisma/client";
import { singleton } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PerformanceProvider } from "./performance-provider.interface";

@singleton()
export class PerformanceProviderRegistry {
  private readonly providers = new Map<
    PerformancePlatform,
    PerformanceProvider
  >();

  register(provider: PerformanceProvider): void {
    if (this.providers.has(provider.platform)) {
      throw new Error(`Provider ${provider.platform} sudah terdaftar.`);
    }
    this.providers.set(provider.platform, provider);
  }

  get(platform: PerformancePlatform): PerformanceProvider {
    const provider = this.providers.get(platform);
    if (!provider)
      throw new ApiError(`Provider ${platform} belum tersedia.`, 503);
    return provider;
  }
}
