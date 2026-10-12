import { container } from "tsyringe";
import { GA4Provider } from "./ga4.provider";
import { GoogleAdsProvider } from "./google-ads.provider";
import { PerformanceProviderRegistry } from "./performance-provider.registry";
import { SearchConsoleProvider } from "./search-console.provider";

let registered = false;

export function registerPerformanceProviders(): void {
  if (registered) return;

  const registry = container.resolve(PerformanceProviderRegistry);
  registry.register(container.resolve(GoogleAdsProvider));
  registry.register(container.resolve(GA4Provider));
  registry.register(container.resolve(SearchConsoleProvider));

  registered = true;
}
