import { describe, expect, it } from "vitest";

import {
  formatInterviewAnswer,
  readInterviewDraft,
  writeInterviewAnswer,
  writeInterviewStepIndex
} from "./interview-draft";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

describe("interview session draft", () => {
  it("stores one editable answer per step and resumes at the saved step", () => {
    const storage = memoryStorage();
    writeInterviewAnswer(
      storage,
      "interview-1",
      { step_code: "name_your_house", selected_options: ["My father"], free_text: "" },
      1
    );
    writeInterviewAnswer(
      storage,
      "interview-1",
      { step_code: "name_your_house", selected_options: ["My parents"], free_text: "Together" },
      1
    );
    writeInterviewStepIndex(storage, "interview-1", 0);

    const draft = readInterviewDraft(storage, "interview-1");
    expect(draft.current_step_index).toBe(0);
    expect(Object.keys(draft.answers)).toEqual(["name_your_house"]);
    expect(formatInterviewAnswer(draft.answers.name_your_house)).toBe("My parents · Together");
  });

  it("fails safely when session storage is unavailable", () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      }
    };
    expect(readInterviewDraft(blockedStorage, "interview-2")).toEqual({
      current_step_index: 0,
      answers: {}
    });
  });
});
