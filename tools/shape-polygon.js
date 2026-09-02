/* Trace the portrait's left edge into a percentage polygon for shape-outside.
 *
 * WHY NOT JUST POINT shape-outside AT THE PNG. Because Chrome sizes an image shape at the
 * image's NATURAL size anchored to the reference box's top-left, rather than stretching it to
 * the float. Measured on the page, that put the outline up to 30% of the float's width away
 * from the body. A polygon is resolved in percentages of the float, which maps exactly at any
 * viewport — verified against a control polygon before committing to this.
 */
const fs=require('fs'),zlib=require('zlib');
function decode(buf){let o=8,ih=null,id=[];while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),d=buf.slice(o+8,o+8+len);
if(t==='IHDR')ih={w:d.readUInt32BE(0),h:d.readUInt32BE(4)};else if(t==='IDAT')id.push(d);else if(t==='IEND')break;o+=12+len;}
const raw=zlib.inflateSync(Buffer.concat(id)),{w,h}=ih,bpp=4,st=w*bpp,out=Buffer.alloc(h*st);let p=0;
for(let y=0;y<h;y++){const f=raw[p++],line=raw.slice(p,p+st);p+=st;const cur=out.slice(y*st,(y+1)*st),prev=y?out.slice((y-1)*st,y*st):null;
for(let x=0;x<st;x++){const a=x>=bpp?cur[x-bpp]:0,b=prev?prev[x]:0,c=(prev&&x>=bpp)?prev[x-bpp]:0;let v=line[x];
if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}
cur[x]=v&0xff;}}return{w,h,data:out};}

const img=decode(fs.readFileSync(process.argv[2]));
const N=parseInt(process.argv[3]||'16',10), THR=12;
function leftAt(y){for(let x=0;x<img.w;x++){if(img.data[(y*img.w+x)*4+3]>THR)return x;}return img.w;}
const pts=[];
for(let i=0;i<N;i++){
  const y0=Math.floor(i*img.h/N), y1=Math.min(img.h-1,Math.floor((i+1)*img.h/N)-1);
  let m=img.w;
  for(let y=y0;y<=y1;y++){const l=leftAt(y); if(l<m)m=l;}   /* leftmost in the band: conservative */
  const xp=(m/img.w*100), yTop=(y0/img.h*100), yBot=((y1+1)/img.h*100);
  pts.push([xp,yTop],[xp,yBot]);
}
const f=n=>n.toFixed(1).replace(/\.0$/,'');
/* down the body's left edge, then back up the float's right side */
const poly='polygon('+pts.map(p=>f(p[0])+'% '+f(p[1])+'%').join(', ')+', 100% 100%, 100% 0%)';
console.log(poly);
console.log('\npoints:',pts.length+2,'  chars:',poly.length);
console.log('\nleft-edge profile (% of width, top to bottom):');
console.log(pts.filter((_,i)=>i%2===0).map(p=>f(p[0])).join('  '));
