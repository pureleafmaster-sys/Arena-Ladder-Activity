import {randomUUID} from "crypto";
import {getMinRating,getProfileHydrationLimit} from "./env";
import {getSupabaseAdmin} from "./supabase";
import {getPvpLeaderboard,getCharacterProfile,getCharacterSpecializations,inferSpec,parseLeaderboardRows,parseProfile} from "./blizzard";
import {activityStatusFromMinutes,inferLikelyTeams} from "./team-detect";
async function hydrate(row:any){try{const prof=await getCharacterProfile(row.realmSlug,row.name);const parsed=parseProfile(prof);const specs=await getCharacterSpecializations(row.realmSlug,row.name);return{...parsed,spec:inferSpec(parsed.className,specs),profileStatus:"ok"};}catch(e){console.warn("hydrate failed",row.name,row.realmSlug,e);return{faction:"Unknown",race:"Unknown",className:"Unknown",gender:"Unknown",spec:"Unknown",profileStatus:"failed"};}}
function mins(iso:string|null){if(!iso)return null;return Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));}
export async function pollBracket(seasonId:string,bracket:string){
 const supabase=getSupabaseAdmin(); const pollId=randomUUID(); const minRating=getMinRating(); const hydrateLimit=getProfileHydrationLimit(); let hydrated=0;
 const rows=parseLeaderboardRows(await getPvpLeaderboard(seasonId,bracket)).filter((x:any)=>x.rating>=minRating); const changed:any[]=[];
 for(const row of rows){const playerId=row.id||`${row.realmSlug}-${row.name}`.toLowerCase();
  const {data:existingPlayer}=await supabase.from("players").select("*").eq("id",playerId).maybeSingle();
  let profile={faction:existingPlayer?.faction||"Unknown",race:existingPlayer?.race||"Unknown",className:existingPlayer?.class_name||"Unknown",gender:existingPlayer?.gender||"Unknown",spec:existingPlayer?.spec||"Unknown",profileStatus:existingPlayer?.profile_status||"pending"};
  const lastRefresh=existingPlayer?.last_profile_refresh?new Date(existingPlayer.last_profile_refresh).getTime():0;
  const shouldHydrate=hydrated<hydrateLimit&&(!existingPlayer||profile.className==="Unknown"||profile.race==="Unknown"||Date.now()-lastRefresh>1000*60*60*24*7);
  if(shouldHydrate){profile=await hydrate(row);hydrated++;}
  await supabase.from("players").upsert({id:playerId,name:row.name,realm_slug:row.realmSlug,realm_name:row.realmName,faction:profile.faction,race:profile.race,class_name:profile.className,spec:profile.spec,gender:profile.gender,profile_status:profile.profileStatus,last_profile_refresh:shouldHydrate?new Date().toISOString():existingPlayer?.last_profile_refresh,updated_at:new Date().toISOString()});
  const {data:latest}=await supabase.from("latest_activity").select("*").eq("player_id",playerId).eq("bracket",bracket).maybeSingle();
  const ratingDelta=latest?row.rating-latest.rating:0,winsDelta=latest?row.wins-latest.wins:0,lossesDelta=latest?row.losses-latest.losses:0,gamesDelta=winsDelta+lossesDelta;
  const active=Boolean(latest&&(ratingDelta||winsDelta||lossesDelta)); const now=new Date().toISOString(); const lastActiveAt=active?now:latest?.last_active_at||null; const status=activityStatusFromMinutes(mins(lastActiveAt||now));
  await supabase.from("ladder_entries").insert({poll_id:pollId,bracket,player_id:playerId,rank:row.rank,rating:row.rating,wins:row.wins,losses:row.losses,rating_delta:ratingDelta,wins_delta:winsDelta,losses_delta:lossesDelta,active,detected_at:now});
  await supabase.from("latest_activity").upsert({player_id:playerId,bracket,rank:row.rank,rating:row.rating,wins:row.wins,losses:row.losses,rating_delta:ratingDelta,wins_delta:winsDelta,losses_delta:lossesDelta,games_delta:gamesDelta,last_active_at:lastActiveAt,last_seen_at:now,session_record:`${Math.max(0,winsDelta)}-${Math.max(0,lossesDelta)}`,activity_status:status});
  if(active)changed.push({player_id:playerId,name:row.name,rating:row.rating,rating_delta:ratingDelta,wins_delta:winsDelta,losses_delta:lossesDelta,games_delta:gamesDelta});
 }
 const teams=inferLikelyTeams(changed,bracket); for(const [playerId,res] of teams.entries()){await supabase.from("latest_activity").update({likely_team:res.team,team_confidence:res.confidence}).eq("player_id",playerId).eq("bracket",bracket);}
 return{bracket,pollId,totalTracked:rows.length,changed:changed.length,hydrated};
}
