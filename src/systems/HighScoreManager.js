/**
 * High score and progress persistence manager via localStorage.
 * Records high scores, star ratings, and interception rates per level.
 */
const STORAGE_KEY = 'lake_patrol_v1_scores';

export class HighScoreManager {
  static getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  static get(levelId) {
    const all = this.getAll();
    return all[levelId] || null;
  }

  /**
   * Records a completed mission run.
   * Returns { isNewRecord: boolean, previousBest: number, currentBest: number, stars: number }
   */
  static record(levelId, score, stars, interceptRate) {
    const all = this.getAll();
    const prev = all[levelId] || null;
    const prevScore = prev ? prev.score : 0;
    const isNewRecord = !prev || score > prevScore;

    const recordObj = {
      score: isNewRecord ? score : prev.score,
      stars: Math.max(stars, prev ? prev.stars : 0),
      interceptRate: isNewRecord ? interceptRate : prev.interceptRate,
      date: new Date().toISOString().split('T')[0],
    };

    all[levelId] = recordObj;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {
      console.warn('Unable to persist high score to localStorage:', e);
    }

    return {
      isNewRecord,
      previousBest: prevScore,
      currentBest: recordObj.score,
      stars: recordObj.stars,
    };
  }

  static clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Unable to clear high scores:', e);
    }
  }
}

