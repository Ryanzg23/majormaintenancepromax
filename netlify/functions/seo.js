export async function handler(event){
  const {url}=JSON.parse(event.body);
  const start=url.startsWith("http")?url:`https://${url}`;

  const redirectChain=[];
  let current=start;

  for(let i=0;i<5;i++){
    const res=await fetch(current,{redirect:"manual"});
    if(res.status>=300&&res.status<400){
      const loc=res.headers.get("location");
      if(!loc)break;
      current=new URL(loc,current).href;
      redirectChain.push({status:res.status,url:current});
    }else break;
  }

  const finalUrl=current;
  const html=await (await fetch(finalUrl)).text();

  const title=html.match(/<title[^>]*>([^<]*)/i)?.[1]||"";
  const description=html.match(/name=["']description["'][^>]*content=["']([^"']*)/i)?.[1]||"";
  const canonical=html.match(/rel=["']canonical["'][^>]*href=["']([^"']*)/i)?.[1]||"";
  const amphtml=html.match(/rel=["']amphtml["'][^>]*href=["']([^"']*)/i)?.[1]||"";

  const root=new URL(finalUrl).origin;

  const robotsRes=await fetch(`${root}/robots.txt`).catch(()=>null);
  const robots=robotsRes&&robotsRes.ok?{found:true,content:await robotsRes.text()}:{found:false};

  const sitemapRes=await fetch(`${root}/sitemap.xml`).catch(()=>null);
  const sitemap=sitemapRes&&sitemapRes.ok?{found:true,content:await sitemapRes.text()}:{found:false};

  return{
    statusCode:200,
    body:JSON.stringify({
      url:start,
      finalUrl,
      redirectChain,
      title,
      description,
      canonical,
      amphtml,
      robots,
      sitemap
    })
  };
}
