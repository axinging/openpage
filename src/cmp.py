
import json
import os

def compareFile(fileName1, fileName2):
    with open(fileName1, "r") as f1:
        file1 = json.loads(f1.read())
    with open(fileName2, "r") as f2:
        file2 = json.loads(f2.read())

    for item in file2:
        #print(item)
        if item not in file1:
            print(f"Diff: {item}")
            #file1.append(item)
        if file1[item] != file2[item] :
            print(f"Diff: {item}")
            #print(file1[item])
            #print(file2[item])

    #print(f"New file1: {file1}")


#fileName = 'data1500-1599'
#compareFile('./fusedata/'+fileName+'.json', './fusedata-no/'+fileName+'.json')


for fileName in os.listdir("./fusedata"):
   print(fileName)
   if fileName.startswith("data"):
      compareFile('./fusedata/'+fileName, './fusedata-no/'+fileName)

