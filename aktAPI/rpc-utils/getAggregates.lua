local logOutput = false

local function getAggregates(wallet)
	local res0 = redis.call('zcount',wallet,'0','0')
	local res1 = redis.call('zcount',wallet,'1','1')
	local res2 = redis.call('zcount',wallet,'2','2')
	local res3 = redis.call('zcount',wallet,'3','3')
	local res4 = redis.call('zcount',wallet,'4','4')

	if logOutput then
		redis.log(redis.LOG_WARNING,"0: "..res0)
		redis.log(redis.LOG_WARNING,"1: "..res1)
		redis.log(redis.LOG_WARNING,"2: "..res2)
		redis.log(redis.LOG_WARNING,"3: "..res3)
		redis.log(redis.LOG_WARNING,"4: "..res4)
	end
	return '{"closed_bids":'..res0..',"open_bids":'..res1..',"lost_bids":'..res2..',"active_leases":'..res3..',"closed_leases":'..res4..'}'
end

local output = '{"closed_bids":0,"open_bids":0,"lost_bids":0,"active_leases":0,"closed_leases":0}'
for i=1, #KEYS do
	if logOutput then
		redis.log(redis.LOG_WARNING,"WALLET TO QUERY "..KEYS[i])
	end
	output = getAggregates(KEYS[i])
	if logOutput then
		redis.log(redis.LOG_WARNING,'OUTPUT'..output)
	end
end
return output
