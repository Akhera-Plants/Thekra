/** «في لحظات مثل هذه» (round 6, C-09): only paths of the app's three topic routes are followed, never another link. Pure. */

const TOPIC_PATH = /^\/(sins|good-deeds|branches)\/[a-z0-9-]+$/;

export function isTopicPath(path: string): boolean {
  return TOPIC_PATH.test(path);
}
