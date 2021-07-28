export class Theme{
	constructor(){

	}
	toggleColorTheme(){
		let newVal = 'dark'; //default toggle to
		console.log('toggle color theme, current val',localStorage.getItem('theme'))
		if(localStorage.getItem('theme') == null){
			//default to light mode
			localStorage.setItem('theme',newVal);
		}
		else{
			newVal = localStorage.getItem('theme') == 'dark' ? 'light' : 'dark';
			localStorage.setItem('theme',newVal);
		}

		this.applyColorTheme(newVal);

	}
	applyColorTheme(newVal){
		console.log('apply color theme',newVal);
		if(newVal == 'dark'){
			$('#toggleTheme .toggle').addClass('isTrue').removeClass('isFalse');
			$('html').addClass('darkTheme');
		}
		if(newVal == 'light'){
			$('#toggleTheme .toggle').removeClass('isTrue').addClass('isFalse');
			$('html').removeClass('darkTheme');
		}
	}
}