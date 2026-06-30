import { randomBytes } from "node:crypto";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function randomUlidLike(date = new Date()): string {
  let time = date.getTime();
  let output = "";

  for (let index = 9; index >= 0; index -= 1) {
    output = ENCODING[time % 32] + output;
    time = Math.floor(time / 32);
  }

  const randomness = randomBytes(10);
  for (const byte of randomness) {
    output += ENCODING[byte % 32];
  }

  return output;
}
