/** A slow device may finish a large roster steadily without being stalled. */
export class ResourceLoadDeadline {
  private lastProgressAt:number;
  private completed=0;
  constructor(private readonly startedAt:number){this.lastProgressAt=startedAt;}
  expired(now:number,completed:number,ready:boolean):boolean{
    if(completed>this.completed){this.completed=completed;this.lastProgressAt=now;}
    if(ready)return false;
    return now-this.startedAt>300000||now-this.lastProgressAt>90000;
  }
}
