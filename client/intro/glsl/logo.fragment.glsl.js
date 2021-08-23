export const LogoFragmentShader = `
uniform float animate;
uniform float opacity;
varying vec3 vColor;

void main() {
	gl_FragColor = vec4(vColor, opacity);
}
`;