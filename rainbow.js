export function rainbow(){
	let width = process.stdout.columns;
	let padding = '';
	for(let i=0;i<width;i++){
		padding += '#';
	}
	let lines = [
		'',
		'There is a pot of gold at the end of every rainbow,',
		'it is the community that is worth the diamonds.',
		''
	];

	console.log('');
	console.log(padding);
	console.log(padding);
	console.log('');
	console.log('                         \x1b[95m_________\x1b[0m')
	console.log('                      \x1b[95m.##\x1b[0m\x1b[36m@@\x1b[0m\x1b[32m&&&&\x1b[0m\x1b[36m@@\x1b[0m\x1b[95m##.\x1b[0m')
	console.log('                   \x1b[95m,##\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m::\x1b[0m\x1b[38;5;9m%&&&%%\x1b[0m\x1b[33m::\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m##.\x1b[0m')
	console.log('                  \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%%\x1b[0m\x1b[38;5;1m%%%HANDY%%\x1b[0m\x1b[38;5;9m%%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
	console.log('                \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m00\'\x1b[0m         \x1b[38;5;1m\'00\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
	console.log('               \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\'\x1b[0m             \x1b[38;5;1m\'0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
	console.log('              \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                 \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
	console.log('             \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                   \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
	console.log('             \x1b[95m#\x1b[0m\x1b[36m@\x1b[0m\x1b[32m&\x1b[0m\x1b[33m:\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[38;5;1m0\x1b[0m                   \x1b[38;5;1m0\x1b[0m\x1b[38;5;9m%\x1b[0m\x1b[33m:\x1b[0m\x1b[32m&\x1b[0m\x1b[36m@\x1b[0m\x1b[95m#\x1b[0m')
	//console.log('             \x1b[95m"\x1b[0m" \x1b[33m\'\x1b[0m "                   " \' "\x1b[95m"\x1b[0m')
	console.log('           \x1b[33m_oOoOoOo_\x1b[0m                    \x1b[92mTHE\x1b[0m ')
	console.log('          (\x1b[33moOoOoOoOo\x1b[0m)                \x1b[92mHANDSHAKE\x1b[0m')
	console.log('           )\`"""""\`(                 \x1b[92mCOMMUNITY\x1b[0m')
	console.log('          /         \\              ')   
	console.log('         |    \x1b[92mHNS\x1b[0m    |              ')
	console.log('         \\           /              ')
	console.log('          \`=========\`')
	console.log('')
	console.log(padding);
	console.log(padding);
	lines.map(l=>{
		let diff = Math.floor(width-l.length)/2;
		let p0 = '', p1 = '';
		for(let i=0;i<diff;i++){
			p0 += ' ';
			p1 += ' ';
		}
		console.log(p0+l+p1);
	});
	console.log(padding);
	console.log(padding);
	console.log('');
}
