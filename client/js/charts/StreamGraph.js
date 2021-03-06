import {invertColor} from './InvertColor.js';
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
		//console.log('dataIN',dataIN);
		let timestamps = 0;
		if(Object.keys(dataIN).length > 0){
			Object.keys(dataIN).map(subID=>{
				timestamps += Object.keys(dataIN[subID]).length;
			})
		}
		//console.log('timestamps???',timestamps)
		if(timestamps == 0 && typeof this.getQueryString()['testStreamgraph'] == "undefined"){
			//no data
			$('.sectionErrorMessage',this.$el).show();
			$('svg',this.$el).hide();
			return;
		}
		else{
			$('.sectionErrorMessage',this.$el).hide();
			$('svg',this.$el).show();
		}
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
		/*let out= ''
		for(let i=0;i<9;i++){
			out += '.darkTheme #streamgraph path.stream.color'+i+'{fill: '+invertColor(color[8-i])+'};\n'
		}
		console.log('css',out);*/
		const ticks = d3.axisBottom(x)
			.ticks(8)
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
							return (ii != i ? 0.25 : 0.8);
						});
						hover(d,d3.mouse(this));
					})
					.on('mousemove',function(d,i){
						hover(d,d3.mouse(this));
					})
					.on('mouseleave',function(d){
						d3.selectAll('path.stream').transition().duration(300).style('opacity',1.0);
						unhover()
					})
					.transition()
					.duration(300)
					.attr("fill", function(d,i) {
						const colorI = 8-i;
						let out = color[colorI];
						for(let x = 0; x < 9; x ++){
							d3.select(this).classed('color'+x,x == colorI);
						}
						return out;
					})
					.attr('data-inverse',(d,i)=>{
						return invertColor(color[8-i]);
					})
					.attr("d", area)
			/*.append("title")
				.text(({key}) => key);*/

			svg.selectAll('g.axis')
				.data([0])
				.join("g")
				.classed('axis',true)
				.call(xAxis);

		const _this = this;
		function hover(data,d3Mouse){
			//console.log('hover',data,d3Elem,d3Mouse)
			const bucketCount = Object.keys(data).length-2;
			const bucketScale = d3.scaleLinear()
				.domain([10,width-10])
				.range([0,bucketCount]);
			const bucket = Math.floor(bucketScale(d3Mouse[0]));
			_this.showTooltip(data[bucket],data.key,d3Mouse[0]);
				
		}
		function unhover(){
			_this.hideTooltip();
		}
	}
	showTooltip(d,index,xPos){
		const {width,height} = this.getDimensions()
		//console.log('show tooltip',data,index,xPos);
		/*
		<div id="streamgraphTooltip">
			<div class="title">Subscriber: <span class="subscriberID">0</span></div>
			<div class="time"></div>
			<div>Bandwidth: <span class="sum"></span></div>
			<div>Download: <span class="download"></span></div>
			<div>Upload: <span class="upload"></span></div>
		</div>
		*/
		if(typeof d == "undefined"){
			return;
		}
		const data = d.data[index+'_data'];
		
		//console.log('data',data,index)
		const $tooltip = $('#streamgraphTooltip');
		const $stripe = $('.stripe');
		$('.title .subscriberID',$tooltip).html(index);
		$('.time',$tooltip).html(moment(d.data.time,'X').format('MMM-DD HH:mm'));
		$('.sum',$tooltip).html(numeral(data.sum).format('0.0b'))
		$('.download',$tooltip).html(numeral(data.down).format('0.0b'))
		$('.upload',$tooltip).html(numeral(data.up).format('0.0b'))
		const w = $tooltip.width();
		const xNow = xPos + 5;
		let x = xNow-w+2;
		let stripeNow = xNow;
		if(xNow-w < 0){
			x = xNow+7;
			stripeNow = x;
			$tooltip.addClass('right');
		}
		else{
			$tooltip.removeClass('right');
		}

		$tooltip.css('left',x);
		$stripe.css('left',stripeNow);
		$tooltip.show();
		$stripe.show();
	}
	hideTooltip(){
		$('#streamgraphTooltip').hide();
		$('.stripe').hide();
	}
	startOf(m, n, unit) {
		//round to nearest n units
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
	}
	getMinTime(data){
		let minTime = Infinity;
		this.timeBinIndex = {2:{},15:{}};
		//data across subs is normalized
		Object.keys(data).slice(0,1).map(subID=>{
			//console.log('data subid',subID,data[subID])
			Object.keys(data[subID]).slice(0,1).map(timestamp=>{
				let time;
				let roundMins = Object.keys(data[subID]).length <= 120 ? 2 : 15;
					
				if(typeof this.timeBinIndex[roundMins][timestamp] == "undefined"){
					time = parseInt(this.startOf(moment(timestamp,'X'),roundMins,'minute').format('X'));
					this.timeBinIndex[roundMins][timestamp] = time;
				}
				else{
					time = this.timeBinIndex[roundMins][timestamp]
				}
				//console.log('time',time,timestamp,roundMins);
				if(time < minTime){
					minTime = time;
				}
			})
		});
		return minTime;
	}
	prefillBins(data){
		let bins = {}

		const maxTime = parseInt(this.startOf(moment(),1,'minute').format('X'));
		let minTime = this.getMinTime(data);//maxTime.clone().subtract(2,'days');
		if(this.getQueryString()['testStreamgraph'] == 'true'){
			minTime = parseInt(moment(maxTime,'X').subtract(2,'days').format('X'));
		}
		console.log('time diff hours',moment().diff(moment(minTime,'X'),'hours'))
		if(moment().diff(moment(minTime,'X'),'hours') <= 2){
			minTime = parseInt(moment(maxTime,'X').subtract('48','hours').format('X'));
		}
		let minsPerBin = 15;
		if(moment(maxTime,'X').diff(moment(minTime,'X'),'minutes')/2 <= 120){
			minsPerBin = 2;
		} 
		//console.log('minmax',minTime,maxTime);
		//console.log('new diff hours',moment(maxTime,'X').diff(moment(minTime,'X'),'hours'))
		
		for(let v=minTime;v<=maxTime;v+=(minsPerBin*60)){
			let i = this.startOf(moment(v,'X'),minsPerBin,'minute').format('X')
			bins[i] = {
				time:i
			};
			Object.keys(data).map(subID=>{
				bins[i][subID] = 0;
				bins[i][subID+'_data'] = {
					up:0,
					down:0,
					sum:0
				}
			});
			if(this.getQueryString()['testStreamgraph'] == 'true'){
		
				//for test data in a sparse graph:::
				const upR0 = Math.floor(Math.random() * 1000000);
				const downR0 = Math.floor(Math.random() * 1000000);
				const upR1 = Math.floor(Math.random() * 1000000);
				const downR1 = Math.floor(Math.random() * 1000000);
				const upR2 = Math.floor(Math.random() * 1000000);
				const downR2 = Math.floor(Math.random() * 1000000);
				bins[i][22] = upR0+downR0;
				bins[i]['22_data'] = {
					sum:upR0+downR0,
					up:upR0,
					down:downR0
				}
				bins[i][44] = upR1+downR1;
				bins[i]['44_data'] = {
					sum:upR1+downR1,
					up:upR1,
					down:downR1
				}
				bins[i][66] = upR2+downR2;
				bins[i]['66_data'] = {
					sum:upR2+downR2,
					up:upR2,
					down:downR2
				}
			}
		};
		//console.log('bins',data,bins,minTime,maxTime);
		return {rows:bins,roundMins:minsPerBin};
	}
	modelData(data){
		const {rows,roundMins} = this.prefillBins(data);
		if(typeof this.roundedTimeIndex == "undefined"){
			this.roundedTimeIndex = {}
		}
		Object.keys(data).map(subscriberID=>{
			Object.keys(data[subscriberID]).map(timestamp=>{
				//let roundMins = Object.keys(data[subscriberID]).length <= 120 ? 2 : 15;
				//console.log('roundMins in data',roundMins)
				let rounded;
				if(typeof this.roundedTimeIndex[timestamp] == "undefined"){
					rounded = this.startOf(moment(timestamp,'X'),roundMins,'minute').format('X');//moment(timestamp,'X').startOf('hour').format('X');
					this.roundedTimeIndex[timestamp] = rounded;
				}
				else{
					rounded = this.roundedTimeIndex[timestamp];
				}
				if(typeof rows[rounded] == "undefined"){
					rows[rounded] = {
						time:rounded
					};
					
					rows[rounded][subscriberID] = data[subscriberID][timestamp].sum;
					rows[rounded][subscriberID+'_data'] = data[subscriberID][timestamp];
				}
				else{
					if(typeof rows[rounded][subscriberID] == "undefined"){
						rows[rounded][subscriberID] = data[subscriberID][timestamp].sum;
						rows[rounded][subscriberID+'_data'] = data[subscriberID][timestamp];
					}
					else{
						rows[rounded][subscriberID] += data[subscriberID][timestamp].sum;
						rows[rounded][subscriberID+'_data'].sum += data[subscriberID][timestamp].sum;
						rows[rounded][subscriberID+'_data'].up += data[subscriberID][timestamp].up;
						rows[rounded][subscriberID+'_data'].down += data[subscriberID][timestamp].down;
					}
					
					
				}

				
			});
		})
		//console.log('rows',rows);
		const rowsArray = Object.keys(rows).map(ts=>{
			return rows[ts];
		});
		//console.log('rowsarray',rowsArray);
		let keys = Object.keys(data);
		if(this.getQueryString()['testStreamgraph'] == 'true'){
			keys = Object.keys(data).concat([22,44,66]);
		}
		return d3.stack()
			//.keys(Object.keys(data))
			.keys(keys) //testing with sparse data in graph
			//.keys([5,22,44,66])
			//.offset(d3.stackOffsetNone)
			.offset(d3.stackOffsetSilhouette)
    		.order(d3.stackOrderNone)
			/*.offset(d3.stackOffsetWiggle)
		    .order(d3.stackOrderInsideOut)*/
	  	(rowsArray);
	}
	getQueryString(){
		// This function is anonymous, is executed immediately and 
		// the return value is assigned to QueryString!
		let query_string = {};
		const query = window.location.search.substring(1);
		let vars = query.split("&");
		for (let i=0;i<vars.length;i++) {
			const pair = vars[i].split("=");
			// If first entry with this name
			if (typeof query_string[pair[0]] === "undefined") {
				query_string[pair[0]] = decodeURIComponent(pair[1]);
				// If second entry with this name
			} else if (typeof query_string[pair[0]] === "string") {
				const arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
				query_string[pair[0]] = arr;
				// If third or later entry with this name
			} else {
				query_string[pair[0]].push(decodeURIComponent(pair[1]));
			}
		} 
		return query_string;
	}
}