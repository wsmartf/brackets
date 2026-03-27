import {
  computeBracketLikelihood,
  getBracketSurvivalState,
  reconstructBracket,
  type BracketPickStatus,
  type EliminatedByPick,
} from "./tournament";

interface GameResultLike {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
  updated_at?: string;
}

export interface SurvivorBracketSummary {
  index: number;
  picks: BracketPickStatus[];
  alive: boolean;
  likelihood: number;
  championPick: string;
  championshipGame: [string, string];
  finalFour: string[];
  eliminatedBy: EliminatedByPick | null;
}

export function buildSurvivorBracketSummaries(
  indices: number[],
  results: GameResultLike[]
): SurvivorBracketSummary[] {
  return indices.map((index) => {
    const bracket = reconstructBracket(index);
    const survivalState = getBracketSurvivalState(bracket, results);
    const semifinalOne = survivalState.picks[60];
    const semifinalTwo = survivalState.picks[61];
    const championship = survivalState.picks[62];

    return {
      index,
      picks: survivalState.picks,
      alive: survivalState.alive,
      likelihood: survivalState.alive ? computeBracketLikelihood(survivalState.picks) : 0,
      championPick: championship?.pick ?? "",
      championshipGame: [
        championship?.team1 ?? "",
        championship?.team2 ?? "",
      ] as [string, string],
      finalFour: [
        semifinalOne?.team1 ?? "",
        semifinalOne?.team2 ?? "",
        semifinalTwo?.team1 ?? "",
        semifinalTwo?.team2 ?? "",
      ].filter(Boolean),
      eliminatedBy: survivalState.eliminated_by,
    };
  });
}
