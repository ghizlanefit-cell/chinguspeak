import React from "react";

import { api } from "@/src/api/client";
import { setCredits, setIsPro, setMonetizationConfig } from "@/src/state/prefs";

export function useMonetizationSync(userToken: string | null) {
  React.useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const settings = await api.publicSettings();
        if (!active) return;
        const map = Object.fromEntries((settings.items || []).map((s) => [s.key, s.value]));
        await setMonetizationConfig({
          playSubscriptionProductId: map.google_play_subscription_product_id || null,
          admobRewardedAdUnitId: map.admob_rewarded_ad_unit_id || null,
        });
      } catch {
        // Non-blocking
      }

      if (!userToken) return;
      try {
        const me = await api.creditsMe(userToken);
        if (!active) return;
        await setCredits(me.credits || 0);
        await setIsPro(!!me.is_pro || !!me.has_active_subscription);
      } catch {
        // Non-blocking
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [userToken]);
}
