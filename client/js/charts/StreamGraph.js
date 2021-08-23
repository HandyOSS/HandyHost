export class StreamGraph{
	constructor($el){
		this.$el = $el;
	}
	getDimensions(){
		return {
			width: $('svg',this.$el).width(),
			height: $('svg',this.$el).height()
		};
	}
	resize(){
		this.render(this.dataset);
	}
	render(dataIN){
		$('.sectionTitle',this.$el).show();
		this.dataset = dataIN;
		const series = this.modelData(dataIN);
		
		const {width,height} = this.getDimensions();
		const area = d3.area()
			.curve(d3.curveNatural)
		    .x(d => x(d.data.time))
		    .y0(d => y(d[0]))
		    .y1(d => y(d[1]));
		const extent = d3.extent(series[0],d=>{return d.data.time;});
		
		const x = d3.scaleLinear()
		    .domain(extent)
		    .range([10,width-10]);
		const y = d3.scaleLinear()
		    .domain([d3.min(series, d => d3.min(d, d => d[0])), d3.max(series, d => d3.max(d, d => d[1]))])
		    .range([height - 30, 10]);
		const color = d3.schemeBlues[9];
		const ticks = d3.axisBottom(x)
			.ticks(width / 80)
			.tickSizeOuter(0)
			.tickFormat(d=>{
				return moment(d,'X').format('MMM-DD HH:mm')
			})
		const xAxis = g => g
		    .attr("transform", `translate(0,${height - 20})`)
		    .call(ticks)
		const svg = d3.select(this.$el[0]).select("svg");

		svg.selectAll("g.streams")
			.data([0])
			.join('g')
			.classed('streams',true)
				.selectAll("path")
				.data(series)
				.join("path")
					.classed('stream',true)
					.on('mouseenter',function(d,i){
						d3.selectAll('path.stream').transition().duration(300).style('opacity',(dd,ii)=>{
							return (ii != i ? 0.25 : 1.0);
						});
					})
					.on('mouseleave',function(d){
						d3.selectAll('path.stream').transition().duration(300).style('opacity',1.0);
					})
					.transition()
					.duration(300)
					.attr("fill", (d,i) => color[8-i])
					.attr("d", area)
			/*.append("title")
				.text(({key}) => key);*/

			svg.selectAll('g.axis')
				.data([0])
				.join("g")
				.classed('axis',true)
				.call(xAxis);
	}
	startOf(m, n, unit) {
		//round to nearest 15 mins
		const units = [
			'year',
			'month',
			'hour',
			'minute',
			'second',
			'millisecond',
		];
		const pos = units.indexOf(unit);
		if (pos === -1) {
			throw new Error('Unsupported unit');
		}
		for (let i = pos + 1; i < units.length; i++) {
			m.set(units[i], 0);
		}
		m.set(unit, Math.floor(m.get(unit) / n) * n);

		return m;
	};
	modelData(data){
		const rows = {};
		Object.keys(data).map(subscriberID=>{
			Object.keys(data[subscriberID]).map(timestamp=>{
				let rounded = this.startOf(moment(timestamp,'X'),15,'minute').format('X');//moment(timestamp,'X').startOf('hour').format('X');
				if(typeof rows[rounded] == "undefined"){
					rows[rounded] = {
						time:rounded
					};
					rows[rounded][subscriberID] = data[subscriberID][timestamp].sum;
					rows[rounded][22] = Math.random() * 10000000;
					rows[rounded][44] = Math.random() * 20000000;
					rows[rounded][66] = Math.random() * 5000000;
					rows[rounded][subscriberID+'_data'] = data[subscriberID][timestamp];
				}
				else{
					rows[rounded][22] += Math.random() * 10000000;
					rows[rounded][44] += Math.random() * 10000000;
					rows[rounded][66] += Math.random() * 10000000;
					rows[rounded][subscriberID] += data[subscriberID][timestamp].sum;
					rows[rounded][subscriberID+'_data'].sum += data[subscriberID][timestamp].sum;
					rows[rounded][subscriberID+'_data'].up += data[subscriberID][timestamp].up;
					rows[rounded][subscriberID+'_data'].down += data[subscriberID][timestamp].down;
				}
				
			});
		})
		const rowsArray = Object.keys(rows).map(ts=>{
			return rows[ts];
		});
		return d3.stack()
			//.keys(Object.keys(data))
			.keys([5,22,44,66])
			//.offset(d3.stackOffsetNone)
			.offset(d3.stackOffsetSilhouette)
    		.order(d3.stackOrderNone)
			/*.offset(d3.stackOffsetWiggle)
		    .order(d3.stackOrderInsideOut)*/
	  	(rowsArray);
	}
}