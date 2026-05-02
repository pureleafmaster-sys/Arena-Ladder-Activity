export type TeamCandidate={player_id:string;name:string;rating:number;rating_delta:number;wins_delta:number;losses_delta:number;games_delta:number};
export function activityStatusFromMinutes(m:number|null){if(m===null)return"seen";if(m<=5)return"hot";if(m<=15)return"active";if(m<=30)return"recent";return"stale";}
export function inferLikelyTeams(players:TeamCandidate[],bracket:string){
 const size=bracket==="5v5"?5:bracket==="3v3"?3:2; const active=players.filter(p=>p.games_delta>0||p.rating_delta!==0); const out=new Map<string,{team:string[],confidence:number}>();
 for(const p of active){const c=active.filter(x=>x.player_id!==p.player_id).map(x=>{let s=0;if(p.wins_delta>0&&x.wins_delta>0)s+=40;if(p.losses_delta>0&&x.losses_delta>0)s+=40;if(p.games_delta===x.games_delta)s+=25;const rd=Math.abs(p.rating_delta-x.rating_delta);if(rd<=3)s+=25;else if(rd<=8)s+=15;else if(rd<=15)s+=8;const rg=Math.abs(p.rating-x.rating);if(rg<=50)s+=15;else if(rg<=150)s+=8;return{...x,score:s};}).filter(x=>x.score>=25).sort((a,b)=>b.score-a.score).slice(0,size-1);
 out.set(p.player_id,{team:[p.name,...c.map(x=>x.name)].slice(0,size),confidence:c.length?Math.min(99,Math.round(c.reduce((a,b)=>a+b.score,0)/c.length)):0});}
 return out;
}
