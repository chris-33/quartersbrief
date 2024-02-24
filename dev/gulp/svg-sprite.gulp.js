import gulp from 'gulp';
import svgSprite from 'gulp-svg-sprite';
import tap from 'gulp-tap';

const INPUTS = [ 'classes', 'ranks' ];

const createSprites = function() {
	return Promise.all(INPUTS.map(input => gulp.src(`dev/art/${input}/*.svg`)
		.pipe(svgSprite({
			mode: {
				defs: {
					sprite: input
				}
			}
		}))
		.pipe(tap(function(file) {
			// Write directly to output directory (svg-sprite wants to put everything in a "defs" subfolder)
			file.dirname = '';			
		}))
		.pipe(gulp.dest('res/www/img'))));
}
createSprites.displayName = 'create-sprites';

export { createSprites };