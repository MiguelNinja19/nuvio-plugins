const assert = require('node:assert/strict');
const {getStreams} = require('./providers/animesonline.js');
(async () => {
 const requests = [];
 global.fetch = async (url) => {
   requests.push(new URL(url).pathname);
   const path = requests.at(-1);
   const body = {'/':'<a href="/anime/one-piece-dublado-online/">One Piece Dublado</a>', '/anime/one-piece-dublado-online/':'<a href="/5832/">One Piece Dublado 002</a><a href="/5831/">One Piece Dublado 001</a>', '/5831/':'<video><source src="https://cdn.example/old.mp4?expire=1"><source src="https://cdn.example/vid.mp4?a=1&amp;b=2"><source src="https://cdn.example/vid.mp4?a=1&amp;b=2"></video><video src="https://redirector.googlevideo.com/videoplayback?mime=video%2Fmp4&amp;expire=4102444800"></video><iframe src="https://cdn.example/embed"></iframe>'}[path];
   return {ok:!!body,text:async()=>body};
 };
 const streams = await getStreams('tmdb:37854','tv',1,1);
 assert.deepEqual(requests,['/','/anime/one-piece-dublado-online/','/5831/']);
 assert.deepEqual(streams.map(x=>x.url),['https://cdn.example/vid.mp4?a=1&b=2','https://redirector.googlevideo.com/videoplayback?mime=video%2Fmp4&expire=4102444800']);
 assert.deepEqual(await getStreams('37854','tv',2,1),[]);
 global.fetch = async () => ({ok:false,status:403});
 assert.deepEqual(await getStreams('tt0388629','tv',1,1),[]);
 console.log('OK: busca, episódio, entidades HTML, deduplicação, expiração, temporada e HTTP 403.');
})().catch(e=>{console.error(e);process.exitCode=1;});

const {playerPaths} = require('./providers/animesonline.js');
const embed = 'https://anidrive.click/token/fixture123';
const schema = '<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'VideoObject',embedUrl:embed}]})+'</script>';
assert.deepEqual(playerPaths(schema), ['/token/fixture123']);
assert.deepEqual(playerPaths(schema+'<iframe src="'+embed+'" data-src="'+embed+'"></iframe><iframe src="https://anidrive.click.example/token/untrusted"></iframe>'), ['/token/fixture123']);
const {dataPath, jsonSources} = require('./providers/animesonline.js');
const issued = '/token/fixture123?player_data=1&player_data_token=' + 'a'.repeat(64);
assert.equal(dataPath(JSON.stringify({endpoint:issued}), '/token/fixture123'), issued);
assert.equal(dataPath(JSON.stringify({endpoint:issued}), '/token/another'), '');
const fixture = {ok:true,slug:'fixture123',title:'One Piece Dublado 001',sources:[{file:'https://redirector.googlevideo.com/videoplayback?expire='+ (Math.floor(Date.now()/1000)+600) + '&itag=22',label:'720p',type:'video/mp4'}]};
assert.equal(jsonSources(JSON.stringify(fixture), '/token/fixture123', 1)[0].title, 'Dublado · PT-BR · 720p');
assert.deepEqual(jsonSources(JSON.stringify({...fixture,title:'One Piece Dublado 002'}), '/token/fixture123', 1), []);
