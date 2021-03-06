export class DonutChart{
	constructor($el){
		this.$el = $el;
	}
	getContainerDimensions(){
		return {
			width:this.$el.width(),
			height: this.$el.height() - $('.donutTitle',this.$el).height()
		}
	}
	render(data){
		console.log('donut data',data);
		const svg = d3.select(this.$el[0]).select('svg');
		const {width,height} = this.getContainerDimensions();
		
		const radius = Math.min(width, height) / 2;
		/*const color = d3.scaleOrdinal()
		    .domain(data.map(d => d.name))
		    .range([])*/
		const color = ['rgba(35,219,117,1.0)','#666']
		const pie = d3.pie()
			.value(function(d) { return d.value; })
			.sort(null);

		const  arc = d3.arc()
			.innerRadius(radius - 20)
			.outerRadius(radius - 10);

		svg.attr("width", width)
			.attr("height", height);
			
		const g = svg.selectAll("g.pie")
			.data([data])
			.join('g')
			.classed("pie",true)
			.attr("transform", "translate(" + radius + "," + height / 2 + ")");
		const arcs = pie(data);
		g.selectAll("path")
			.data(arcs)
			.join("path")
				.attr("fill", (d,i) => color[i])
				.attr("d", arc)
				.classed('on',(d,i)=>{
					return i == 0;
				})

		const percX = radius/2;
		const textPercentage = g.selectAll('text')
			.data([data])
			.join('text')
				.attr('x',5)
				.attr('text-anchor','middle')
				.text(numeral(data[0].value/data[1].value).format('0.00%'))
		textPercentage.attr('y',function(d){
			const h = d3.select(this).node().getBoundingClientRect().height;
			return h/2-5;
		})
		const labelX = radius*2 + 20;
		const labelG = d3.select(this.$el[0]).selectAll('div.labels')
			.data([data])
			.join('div')
			.classed('labels',true)
			.style('left',labelX+'px')
			.style('top',height/2+'px')
			.style('width',(width-labelX-10)+'px');

		const labels = labelG.selectAll('div.label')
			.data(arcs)
			.join('div')
				.classed('label',true);

		labels.selectAll('div.swatch')
			.data((d,i)=>{
				d.color = color[i];
				console.log('swatch d',d);
				return [d];
			})
			.join('div')
				.classed('swatch',true)
				.style('background',d=>d.color)
		labels.selectAll('div.text')
			.data((d,i)=>[d])
			.join('div')
				.classed('text',true)
				.text(d=>{console.log('text label',d);return d.data.formatted.toUpperCase()+' '+d.data.name;})
	}
}