package com.rayquelabs.lifeos;
import java.util.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
public class PhotoRulesTest {
 interface Work {void run() throws Exception;}
 static int checks=0;
 static void rejects(Work work)throws Exception {try{work.run();}catch(IllegalArgumentException|IOException expected){checks++;return;}throw new AssertionError("Expected rejection");}
 static void check(boolean ok){if(!ok)throw new AssertionError();checks++;}
 public static void main(String[] args)throws Exception {
  List<List<String>> groups=Arrays.asList(Arrays.asList("1","2","3"),Arrays.asList("4","5"));
  check(PhotoRules.validateSelection(groups,Arrays.asList("2","5")).equals(Arrays.asList("2","5")));
  rejects(()->PhotoRules.validateSelection(groups,Arrays.asList("1")));
  rejects(()->PhotoRules.validateSelection(groups,Arrays.asList("4","5")));
  rejects(()->PhotoRules.validateSelection(groups,Arrays.asList("999")));
  rejects(()->PhotoRules.validateSelection(groups,Arrays.asList("2","2")));
  rejects(()->PhotoRules.validateSelection(groups,Collections.emptyList()));
  rejects(()->PhotoRules.validateSelection(groups,Collections.nCopies(101,"2")));
  byte[] a="abc".getBytes(StandardCharsets.UTF_8),b="abd".getBytes(StandardCharsets.UTF_8);
  String hash=PhotoRules.digest(new ByteArrayInputStream(a),3,10,()->false);
  check(hash.equals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
  check(!hash.equals(PhotoRules.digest(new ByteArrayInputStream(b),3,10,()->false)));
  rejects(()->PhotoRules.digest(new ByteArrayInputStream(a),4,10,()->false));
  rejects(()->PhotoRules.digest(new ByteArrayInputStream(a),3,2,()->false));
  rejects(()->PhotoRules.digest(new ByteArrayInputStream(a),3,10,()->true));
  System.out.println("PhotoRules: "+checks+" checks passed");
 }
}
