import http from "k6/http";
import { check, sleep } from "k6";
export const options={scenarios:{baseline:{executor:"ramping-arrival-rate",startRate:5,timeUnit:"1s",preAllocatedVUs:20,maxVUs:100,stages:[{target:25,duration:"1m"},{target:50,duration:"2m"},{target:5,duration:"1m"}]}},thresholds:{http_req_failed:["rate<0.01"],http_req_duration:["p(95)<800","p(99)<1500"],checks:["rate>0.99"]}};
const base=__ENV.BASE_URL||"http://127.0.0.1:3002";
export default function(){const r=http.get(`${base}/api/observabilidad`,{timeout:"3s"});check(r,{"health 200":x=>x.status===200,"respuesta acotada":x=>x.timings.duration<1500});sleep(0.2);}
