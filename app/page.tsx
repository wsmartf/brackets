"use client";

import FinalNHomepage from "@/components/FinalNHomepage";
import StandardHomepage from "@/components/StandardHomepage";
import { useHomepageData } from "@/hooks/useHomepageData";

export default function Home() {
  const data = useHomepageData();

  if (data.remaining <= 20) {
    return <FinalNHomepage {...data} />;
  }

  return <StandardHomepage {...data} />;
}
