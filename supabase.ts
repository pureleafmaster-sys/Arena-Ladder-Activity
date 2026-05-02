export function env(name:string,fallback?:string){const v=process.env[name]??fallback;if(!v)throw new Error(`Missing env var: ${name}`);return v;}
export function optionalEnv(name:string,fallback=""){return process.env[name]??fallback;}
export function getMinRating(){return Number(process.env.MIN_RATING||2100);}
export function getPollBrackets(){return (process.env.POLL_BRACKETS||"3v3,5v5").split(",").map(x=>x.trim()).filter(Boolean);}
export function getProfileHydrationLimit(){return Number(process.env.PROFILE_HYDRATION_LIMIT||80);}
