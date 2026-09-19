javascript:(async function(){
  const url = 'https://script.google.com/macros/s/AKfycbxDAInTvmvfJZsMKbgpkYAP8wEedpAvRIv5t2s_QcNbUUaZp8h2bMr5A9XoII2_5C9hCw/exec';
  alert('Iniciando captura forense...');
  
  let imgBase64 = "";
  let imgNode = document.querySelector('article img[style*="object-fit: cover"]') || document.querySelector('img');
  
  if(imgNode) {
    try {
      let canvas = document.createElement('canvas');
      canvas.width = imgNode.naturalWidth || imgNode.width;
      canvas.height = imgNode.naturalHeight || imgNode.height;
      canvas.getContext('2d').drawImage(imgNode, 0, 0);
      imgBase64 = canvas.toDataURL('image/jpeg').split(',')[1];
    } catch(e) { console.log('Restricción CORS local en imagen'); }
  }

  let textNodes = document.querySelectorAll('span[dir="auto"], div[dir="auto"]');
  let comments = Array.from(textNodes).map(n => n.innerText).filter(t => t.trim().length > 0);

  try {
    await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ image: imgBase64, comments: comments }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    alert('Extracción enviada al Laboratorio. Revisa Telegram.');
  } catch(err) {
    alert('Error enviando datos: ' + err);
  }
})();
