// Keep an open map on the server's published data revision. Upload forms are separate.
(function(){
  let revision;
  async function check(){
    try{
      const response=await fetch('/api/data-revision',{cache:'no-store'});
      if(!response.ok)return;
      const value=(await response.json()).revision;
      if(!value)return;
      if(revision&&revision!==value){window.location.reload();return;}
      revision=value;
    }catch{/* Temporary loss of connectivity keeps the current map. */}
  }
  check();setInterval(check,60000);
})();
