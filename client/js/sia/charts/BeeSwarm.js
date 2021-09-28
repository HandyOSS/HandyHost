import {hastingsToSiacoins} from '../siaUtils.js';
export class BeeSwarm{
	constructor($el){
		this.$el = $el;
	}
	getContainerDimensions(){
		return {
			width:this.$el.width(),
			height:this.$el.height(),
			parentHeight: this.$el.parent().height()
		}
	}
	render(data,chainHeightNow){
		console.log('render bees',data,chainHeightNow);
		const maxChainHeight = d3.max(data,(d)=>{
			return d.proofdeadline;
		});
		const {width} = this.getContainerDimensions();
		const padding = 25;
		const xScale = d3.scaleLinear()
			.range([padding,width-padding])
			.domain([chainHeightNow,maxChainHeight]);
		const radiusScale = d3.scaleLinear()
			.range([3,15])
			.domain([0,d3.max(data,d=>{
				return hastingsToSiacoins(d.validproofoutputs[1].value).toNumber();
			})]);
		
		const svg = d3.select(this.$el[0]).select('svg');
		const {parentHeight} = this.getContainerDimensions();
		const height = parentHeight > 200 ? 200 : parentHeight;
		svg.style('height',height+'px');
		//console.log('wh',width,height,this.$el);
		
		const axes = svg.selectAll('g.axes')
			.data([0])
			.join('g')
				.classed('axes',true)
				.attr('transform','translate(0,'+(height/2)+')');
			
			

		const g = svg.selectAll('g.nodes')
			.data([0])
			.join('g')
				.classed('nodes',true)
				.attr('transform','translate(0,0)')
		

		data.map(d=>{
			let rand = Math.random()*10;
			let deg = Math.random()*Math.PI*2;
			d.x = xScale(d.expirationheight) + Math.sin(deg)*rand;
			d.y = height/2  + (Math.cos(deg)*rand);
			d.radius = radiusScale(hastingsToSiacoins(d.validproofoutputs[1].value).toNumber())
		})
		
		const defaultColor = 'rgba(35,219,117,0.6)';
		const grey = 'rgba(161,161,161,0.4)';
		const highlightColor = 'rgba(35,219,117,1.0)';
		let isClicked = false;
		g.selectAll('circle.node')
			.data(data)
			.join('circle')
				.classed('node',true)
				.attr('r',d=>d.radius)
				.attr('cx',d=> xScale(d.expirationheight))
				.attr('cy',height/2)
				.attr('fill',defaultColor)
				.on('mouseenter',d=>{
					if(!isClicked){
						/*g.selectAll('circle.node').attr('fill',(allC)=>{
							
							if(allC.index != d.index){
								return grey
							}
							return highlightColor;
						})*/
						g.selectAll('circle.node').classed('grey',(allC)=>{
							if(allC.index != d.index){
								return true;
							}
							return false;
						})
						g.selectAll('circle.node').classed('highlighted',(allC)=>{
							if(allC.index != d.index){
								return false;
							}
							return true;
						})


						this.showTooltip(d,chainHeightNow);
					}
				})
				.on('click',d=>{

					/*g.selectAll('circle.node').attr('fill',(allC)=>{
						if(allC.index != d.index){
							allC.clicked = false;
							return grey
						}
						return highlightColor;
					})*/
					g.selectAll('circle.node').classed('grey',(allC)=>{

						if(allC.index != d.index){
							allC.clicked = false;
							return true;
						}
						return false;
					})
					g.selectAll('circle.node').classed('highlighted',(allC)=>{
						if(allC.index != d.index){
							allC.clicked = false;
							return false;
						}
						return true;
					})
					d.clicked = typeof d.clicked == "undefined" ? true : !d.clicked;
					isClicked = d.clicked;

					this.showTooltip(d,chainHeightNow);
				})
				.on('mouseleave',(d)=>{
					
					/*g.selectAll('circle.node').attr('fill',(allC)=>{
						if(isClicked){
							return allC.clicked ? highlightColor : grey;
						}
						return defaultColor;
					})*/
					g.selectAll('circle.node').classed('grey',(allC)=>{
						if(isClicked){
							return true;
						}
						return false;
					})
					g.selectAll('circle.node').classed('highlighted',(allC)=>{
						if(isClicked && allC.clicked){
							return true;
						}
						return false;
					})

					if(!isClicked){
						this.hideTooltip();
					}
				})
		svg.on('click',()=>{
			console.log('svg click',d3.event);
			if(d3.event.target.tagName == 'svg'){
				this.hideTooltip();
				isClicked = false;
				g.selectAll('circle.node').classed('highlighted',false);
				g.selectAll('circle.node').classed('grey',false);
			}
		})
		let axis = d3.axisBottom(xScale);

		axes.call(axis);

		function tick(){

			d3.selectAll('circle.node')
				.attr('cx', function(d){return d.x})
				.attr('cy', function(d){return d.y})

		}
		this.simulation = d3.forceSimulation(data)
		.force('x', d3.forceX(function(d){
				return xScale(d.expirationheight)
			}).strength(0.99)
		)
		.force('y', d3.forceY(height/2).strength(0.05))	
		.force('collide', d3.forceCollide().radius(d=>{
			return d.radius;
		}))
		.alphaDecay(0.01)
		.alpha(0.15)
		.on('tick', tick)	
	}
	hideTooltip(){
		$('#beeswarmTooltip').hide();
	}
	showTooltip(data,heightNow){
		const $meta = $('<div />')
		$meta.append('<div>Expiration Height: '+data.expirationheight+' <small>(~'+Math.floor((data.expirationheight-heightNow)/144*100)/100+' days)</small></div>');
		$meta.append('<div>Proof Deadline: '+data.proofdeadline+' <small>(~'+Math.floor((data.proofdeadline-heightNow)/144*100)/100+' days)</small></div>');
		$meta.append('<div>Value+Collateral: '+Math.floor(hastingsToSiacoins(data.validproofoutputs[1].value).toNumber()*100)/100+'SC</div>')
		$meta.append('<div>Storage Size: '+numeral(data.datasize).format('0.00b').toUpperCase()+'</div>')
		$('#beeswarmTooltip').html($meta)
		let left = data.x - ($('#beeswarmTooltip').width()/2) + (this.$el.offset().left - this.$el.offsetParent().offset().left)
		//let top = data.y + data.radius*2 + 20 + $('#beeswarmTooltip').height()/2 + 15;
		let beeDims = this.$el.find('svg')[0].getBoundingClientRect();
		let parDims = $('.contractsChart')[0].getBoundingClientRect();
		let top = data.y + data.radius*2 + 20 + ( beeDims.top - parDims.top); 
		
		$('#beeswarmTooltip').css({
			left:left,
			top:top
		})
		$('#beeswarmTooltip').show();
	}
}