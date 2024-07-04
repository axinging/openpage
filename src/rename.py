import os
for filename in os.listdir("."):
   print(filename)
   if filename.startswith("fuse"):
      os.rename(filename, filename[4:])
 
