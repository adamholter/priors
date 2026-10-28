"use client";
import { createContext, useContext } from "react";
import { LIGHT_PALETTE, type ChartPalette } from "./palette";

/** The chart palette in effect: the site's, or the page theme's. Separate from `echarts.ts` so the site theme can provide it without loading ECharts. */
export const ChartPaletteContext = createContext<ChartPalette>(LIGHT_PALETTE);
export const useChartPalette = () => useContext(ChartPaletteContext);
