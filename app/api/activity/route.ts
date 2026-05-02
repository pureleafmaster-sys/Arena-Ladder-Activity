import {NextResponse} from "next/server";
import {getSupabaseAdmin} from "@/lib/supabase";
import {getMinRating} from "@/lib/env";
import {activityStatusFromMinutes} from "@/lib/team-detect";
export const dynamic="force-dynamic";
function mins(iso:string|null){if(!iso)return null;return Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));}
export async function GET(req:Request){
 const url=new URL(req.url);const bracket=url.searchParams.get("bracket")||"3v3";const minRating=Number(url.searchParams.get("minRating")||getMinRating());const q=(url.searchParams.get("q")||"").toLowerCase();const supabase=getSupabaseAdmin();
 const {data,error}=await supabase.from("latest_activity").select(`*,players:player_id(id,name,realm_slug,realm_name,faction,race,class_name,spec)`).eq("bracket",bracket).gte("rating",minRating).order("last_active_at",{ascending:false,nullsFirst:false}).order("rating",{ascending:false}).limit(500);
 if(error)return NextResponse.json({error:error.message},{status:500});
 const items=(data||[]).map((x:any)=>{const p=x.players||{};const m=mins(x.last_active_at||x.last_seen_at);return{playerId:x.player_id,rank:x.rank,rankDelta:0,name:p.name||"Unknown",realm:p.realm_name||p.realm_slug||"Unknown",realmSlug:p.realm_slug||"",faction:p.faction||"Unknown",race:p.race||"Unknown",className:p.class_name||"Unknown",spec:p.spec||"Unknown",bracket:x.bracket,wins:x.wins,losses:x.losses,rating:x.rating,ratingDelta:x.rating_delta||0,winsDelta:x.wins_delta||0,lossesDelta:x.losses_delta||0,gamesDelta:x.games_delta||0,trackedMinutesAgo:m,team:x.likely_team?.length?x.likely_team:[p.name].filter(Boolean),teamConfidence:x.team_confidence||0,session:x.session_record||"0-0",activityStatus:activityStatusFromMinutes(m)}})
 const filtered=q?items.filter((p:any)=>`${p.name} ${p.realm} ${p.faction} ${p.race} ${p.className} ${p.spec}`.toLowerCase().includes(q)):items;
 return NextResponse.json({items:filtered,count:filtered.length});
}
