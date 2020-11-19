### How to setup the policy?
Here is the scenarios:

1. I want to **block** **application 1** (app1) from *sensor1* (s1) **in the morning at 6 to 7 every day**.
2. I do not want **application 2** (app2) get **any sensor data** during the working hours (**8 am to 5 pm**).
3. I only **allow** **sensor 2** (s2) and **sensor 3** (s3) be accessed by **any application** **in the afternoon**.
<br>
<br>

The privacy polilcy will be like this
<table class="table">
   <thead>
      <tr>
         <th scope="col" colspan="5" style="text-align:center;">Privacy Policy</th>
      </tr>
   </thead>
   <tbody>
      <tr>
         <td scope="col">#</td>
         <td scope="col">Sensors</td>
         <td scope="col">Apps</td>
         <td scope="col">Schedule</td>
         <td scope="col" >Block/Allow</td>
      </tr>
      <tr>
         <th scope="row">1</th>
         <td >s1</td>
         <td >app1</td>
         <td >* 06-07 * *</td>
         <td >Block</td>
      </tr>
      <tr>
         <th scope="row">2</th>
         <td >*</td>
         <td >app2</td>
         <td >* 08-17 * *</td>
         <td >Block</td>
      </tr>
      <tr>
         <th scope="row">3</th>
         <td >s2,s3</td>
         <td >*</td>
         <td >* 12-17 * *</td>
         <td >Allow</td>
      </tr>
   </tbody>
</table>
<br>

### What is the schedule?
Schedule format (cron like)
```
*    *    *    *
┬    ┬    ┬    ┬
│    │    │    │
│    │    │    │
│    │    │    └───── month (1 - 12)
│    │    └────────── day of month (1 - 31)
│    └─────────────── hour (0 - 23)
└──────────────────── minute (0 - 59)
```
<br>

### Tips for setting up the policy
1. When picking up the time, you can at most pick 2 (start and end).
2. When picking up "*", do not pick any other options.
3. Remember to click the "Set Policy" button after you pick the policy
<br>

### Let's set your own policy!
