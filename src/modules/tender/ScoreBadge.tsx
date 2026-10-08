/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-012 -- the scorecard grade of a transporter (A, B, C, D or NEW) with its text on hover.
import { pill } from './tender';

export function ScoreBadge({ score }: { score?: any }) {
  if (!score) return null;
  return <span title={score.text || ''} className={pill(score.grade)}>{score.grade}{score.score != null ? ` ${Number(score.score)}` : ''}</span>;
}
