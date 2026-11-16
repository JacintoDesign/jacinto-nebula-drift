/** Resolve a public asset path against the deploy base (the app can live under a subpath). */
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, '')
