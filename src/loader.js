// Promise is used to guarantee scripts are loaded in order.
async function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.onload = resolve;
    script.onerror = reject;
    script.src = url;
    if (url.startsWith('http')) {
      script.crossOrigin = 'anonymous';
    }
    document.body.append(script);
  })
}

function processUrls(urls, localBuild) {
  for (let i = 0; i < urls.length; i++) {
    let name =
        urls[i].split('/')[0].replace('tfjs-', '').replace('backend-', '');
    if (localBuild.includes(name)) {
      urls[i] = `./bin/${urls[i]}`;
    } else {
      urls[i] =
          `https://unpkg.com/@tensorflow/${urls[i].replace('/', '@latest/')}`;
    }
  }
}

function getURLState(url) {
  let params = new URLSearchParams(url);
  return params;
}

async function setupTFJS() {
  const urlState = getURLState(location.search);

  let urls = [
    'tfjs-core/dist/tf-core.js',
    'tfjs-backend-cpu/dist/tf-backend-cpu.js',
    'tfjs-backend-webgl/dist/tf-backend-webgl.js',
    'tfjs-backend-webgpu/dist/tf-backend-webgpu.js',
    'tfjs-layers/dist/tf-layers.js',
    'tfjs-converter/dist/tf-converter.js',
    'tfjs-backend-wasm/dist/tf-backend-wasm.js',
    'tfjs-automl/dist/tf-automl.js',
  ];

  let localBuild = [];
  if (urlState && urlState.has('localBuild')) {
    localBuild = urlState.get('localBuild').split(',');
  }
  processUrls(urls, localBuild);

  for (let url of urls) {
    await loadScript(url);
  }
  return urlState.get('backend');
}
