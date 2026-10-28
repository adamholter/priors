"use client";
import { createContext, useContext } from "react";
import { INDEX_SCORE_AXIS, type ScoreAxis } from "./score-scale";

export { INDEX_SCORE_AXIS, scoreRange, type ScoreAxis } from "./score-scale";
export const ScoreAxisContext = createContext<ScoreAxis>(INDEX_SCORE_AXIS);
export const useScoreAxis = () => useContext(ScoreAxisContext);
