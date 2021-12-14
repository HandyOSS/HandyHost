local logOutput = false

local function cleanup()
	local removedCount = redis.call('zcount','toRemove','1','1')
	local toRemoveOrderIDs = redis.call('zrange','toRemove','0','-1')
	--remove lease_orderID

	for i=1,#toRemoveOrderIDs,2 do
		redis.call('del','lease_'..toRemoveOrderIDs[i])
		redis.call('zrem','toRemove',toRemoveOrderIDs[i])
	end
	if logOutput then
		--log stuff		
	end

	return '{"removed":'..removedCount..'}'
end

local output = '{"removed":0}'

output = cleanup()

return output
